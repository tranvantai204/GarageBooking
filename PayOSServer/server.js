// server.js
// Express server tích hợp PayOS (ES Modules)
// - Đọc biến môi trường từ .env
// - API: create payment, webhook xác thực HMAC, get order status
// - Lưu đơn hàng giả lập trong bộ nhớ (in-memory)

import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';

const {
  PAYOS_CLIENT_ID,
  PAYOS_API_KEY,
  PAYOS_CHECKSUM_KEY,
  PORT: ENV_PORT,
} = process.env;

const app = express();

// Lưu raw body (để debug nếu cần) và parse JSON
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); }
}));

// In-memory stores (giả lập DB)
const orders = new Map(); // key: orderCode (string)
const processedOrderCodes = new Set(); // idempotency cho webhook
const userBalances = new Map(); // key: userId, value: number

// Helper: tạo orderCode ngắn gọn nhưng đủ unique
const generateOrderCode = () => Number(String(Date.now()).slice(-9));

// 1) Tạo link thanh toán
app.post('/api/payments/create', async (req, res) => {
  try {
    const { bookingId, amount, description, returnUrl, cancelUrl, userId } = req.body || {};

    if (!PAYOS_CLIENT_ID || !PAYOS_API_KEY) {
      return res.status(400).json({ success: false, message: 'Missing PAYOS_CLIENT_ID or PAYOS_API_KEY' });
    }
    if (!amount || Number.isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: 'amount is required and must be a number' });
    }

    const orderCode = generateOrderCode();
    const payload = {
      orderCode,
      amount: Number(amount),
      description: String(description || `BOOK-${orderCode}`),
      returnUrl: String(returnUrl || 'https://garagebooking.onrender.com/payos/return'),
      cancelUrl: String(cancelUrl || 'https://garagebooking.onrender.com/payos/cancel'),
      webhookUrl: String(process.env.PAYOS_WEBHOOK_URL || 'https://garagebooking.onrender.com/api/payments/payos'),
      items: [
        { name: String(description || `BOOK-${orderCode}`), quantity: 1, price: Number(amount) },
      ],
    };

    const endpoint = 'https://api-merchant.payos.vn/v2/payment-requests';
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': PAYOS_CLIENT_ID,
        'x-api-key': PAYOS_API_KEY,
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const text = await resp.text();
    let data = {};
    try { data = JSON.parse(text || '{}'); } catch (_) { data = { raw: text }; }

    const checkoutUrl = data?.data?.checkoutUrl || data?.checkoutUrl;
    if (!resp.ok || !checkoutUrl) {
      console.error('PayOS create-link failed', { status: resp.status, endpoint, data });
      return res.status(400).json({ success: false, message: data?.desc || data?.message || 'PayOS create link failed', details: data, request: payload });
    }

    // Lưu đơn hàng (giả lập)
    orders.set(String(orderCode), {
      id: String(orderCode),
      orderCode,
      bookingId: bookingId || null,
      userId: userId || null,
      amount: Number(amount),
      description: payload.description,
      status: 'pending',
      createdAt: new Date().toISOString(),
      returnUrl: payload.returnUrl,
      cancelUrl: payload.cancelUrl,
    });

    return res.json({ success: true, data: { checkoutUrl, orderCode } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Debug: kiểm tra biến môi trường PayOS có mặt chưa
app.get('/api/payments/debug', (_req, res) => {
  const redact = (v) => (v ? `${String(v).slice(0, 3)}...${String(v).slice(-3)}` : null);
  return res.json({
    success: true,
    data: {
      hasClientId: !!PAYOS_CLIENT_ID,
      hasApiKey: !!PAYOS_API_KEY,
      hasChecksum: !!PAYOS_CHECKSUM_KEY,
      endpoint: 'https://api-merchant.payos.vn/v2/payment-requests',
      clientIdSample: redact(PAYOS_CLIENT_ID),
      apiKeySample: redact(PAYOS_API_KEY),
    },
  });
});

// 2) Webhook PayOS: xác thực HMAC và cập nhật đơn hàng
app.post('/api/payments/payos', async (req, res) => {
  try {
    const { data, signature } = req.body || {};
    if (!data || !signature) {
      return res.status(400).json({ success: false, message: 'Missing data or signature' });
    }
    if (!PAYOS_CHECKSUM_KEY) {
      return res.status(400).json({ success: false, message: 'Missing PAYOS_CHECKSUM_KEY' });
    }

    // Tính HMAC SHA256 trên chuỗi JSON của data
    const computedSignature = crypto
      .createHmac('sha256', PAYOS_CHECKSUM_KEY)
      .update(JSON.stringify(data))
      .digest('hex');

    if (String(computedSignature).toLowerCase() !== String(signature).toLowerCase()) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const orderCode = data.orderCode || data.order_code || data.id;
    const status = (data.status || data.transactionStatus || '').toUpperCase();
    const amount = Number(data.amount || data.orderAmount || 0);
    const description = data.description || data.orderDescription || '';

    if (!orderCode) {
      return res.status(200).json({ success: true, message: 'No orderCode in webhook' });
    }

    // Idempotent xử lý
    if (processedOrderCodes.has(String(orderCode))) {
      return res.status(200).json({ success: true, message: 'Already processed' });
    }

    const order = orders.get(String(orderCode));
    if (!order) {
      // Vẫn trả 200 cho PayOS, nhưng log để tra soát
      console.warn('Webhook order not found:', orderCode);
      processedOrderCodes.add(String(orderCode));
      return res.status(200).json({ success: true, message: 'Order not found, ignored' });
    }

    if (status === 'PAID' || status === 'SUCCESS' || data.code === '00') {
      order.status = 'paid';
      order.paidAt = new Date().toISOString();
      orders.set(String(orderCode), order);

      // Nếu là nạp tiền (giả lập): tăng số dư
      if (order.userId && /^TOPUP-/i.test(order.description || description)) {
        const current = Number(userBalances.get(String(order.userId)) || 0);
        userBalances.set(String(order.userId), current + Number(amount));
      }
    } else if (status === 'CANCELLED' || status === 'CANCELED' || status === 'FAILED') {
      order.status = 'failed';
      order.failedAt = new Date().toISOString();
      orders.set(String(orderCode), order);
    }

    processedOrderCodes.add(String(orderCode));
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Health (GET) for providers that validate webhook by GET
app.get('/api/payments/payos', (_req, res) => {
  return res.status(200).json({ success: true, message: 'PayOS webhook is alive. Use POST to deliver events.' });
});

// 3) Lấy thông tin đơn hàng
app.get('/api/orders/:id', (req, res) => {
  const id = String(req.params.id || '').trim();
  const order = orders.get(id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  return res.json({ success: true, data: order });
});

// Health check
app.get('/', (_req, res) => res.send('PayOS Webhook Server is running'));

const PORT = Number(ENV_PORT || 3000);
app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});


