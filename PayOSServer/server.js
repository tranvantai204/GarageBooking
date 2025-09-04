// server.js
// Express server tích hợp PayOS (ES Modules)
// - Đọc biến môi trường từ .env
// - API: create payment, webhook xác thực HMAC, get order status
// - Lưu đơn hàng giả lập trong bộ nhớ (in-memory)

import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';

const {
  // MoMo
  MOMO_PARTNER_CODE,
  MOMO_ACCESS_KEY,
  MOMO_SECRET_KEY,
  MOMO_ENDPOINT,
  MOMO_REDIRECT_URL,
  MOMO_IPN_URL,
  // Server
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

// 1) Tạo link thanh toán MoMo
app.post('/api/payments/create', async (req, res) => {
  try {
    const { bookingId, amount, description, returnUrl, cancelUrl, userId } = req.body || {};

    if (!MOMO_PARTNER_CODE || !MOMO_ACCESS_KEY || !MOMO_SECRET_KEY) {
      return res.status(400).json({ success: false, message: 'Missing MOMO_PARTNER_CODE or MOMO_ACCESS_KEY or MOMO_SECRET_KEY' });
    }
    if (!amount || Number.isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: 'amount is required and must be a number' });
    }
    // Build MoMo request
    const orderCode = String(Date.now());
    const requestId = orderCode;
    const orderInfo = String(description || `BOOK-${orderCode}`);
    const redirectUrl = String(returnUrl || MOMO_REDIRECT_URL || 'https://garagebooking.onrender.com/momo/return');
    const ipnUrl = String(MOMO_IPN_URL || 'https://garagebooking.onrender.com/api/payments/momo');
    const requestType = 'captureWallet';
    const extra = Buffer.from(JSON.stringify({ bookingId: bookingId || null, userId: userId || null })).toString('base64');

    const rawSignature = `accessKey=${MOMO_ACCESS_KEY}&amount=${Number(amount)}&extraData=${extra}&ipnUrl=${ipnUrl}&orderId=${orderCode}&orderInfo=${orderInfo}&partnerCode=${MOMO_PARTNER_CODE}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    const signature = crypto.createHmac('sha256', MOMO_SECRET_KEY).update(rawSignature).digest('hex');

    const payload = {
      partnerCode: MOMO_PARTNER_CODE,
      accessKey: MOMO_ACCESS_KEY,
      requestId,
      amount: Number(amount),
      orderId: orderCode,
      orderInfo,
      redirectUrl,
      ipnUrl,
      requestType,
      extraData: extra,
      lang: 'vi',
      signature,
    };

    const endpoint = MOMO_ENDPOINT || 'https://payment.momo.vn/v2/gateway/api/create';
    const resp = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const text = await resp.text();
    let data = {}; try { data = JSON.parse(text || '{}'); } catch (_) { data = { raw: text }; }

    const payUrl = data?.payUrl || data?.deeplink || data?.qrCodeUrl;
    if (!resp.ok || !payUrl || data?.resultCode !== 0) {
      console.error('MoMo create failed', { status: resp.status, endpoint, data });
      return res.status(400).json({ success: false, message: data?.message || 'MoMo create link failed', details: data, request: { ...payload, signature: '<redacted>' } });
    }

    // Lưu đơn hàng (giả lập)
    orders.set(String(orderCode), {
      id: String(orderCode),
      orderCode: String(orderCode),
      bookingId: bookingId || null,
      userId: userId || null,
      amount: Number(amount),
      description: orderInfo,
      status: 'pending',
      createdAt: new Date().toISOString(),
      provider: 'momo',
      redirectUrl,
      ipnUrl,
    });

    return res.json({ success: true, data: { checkoutUrl: payUrl, orderCode } });
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

// 2) Webhook MoMo IPN: xác thực HMAC và cập nhật đơn hàng
app.post('/api/payments/momo', async (req, res) => {
  try {
    const body = req.body || {};
    if (!MOMO_SECRET_KEY || !MOMO_ACCESS_KEY) {
      return res.status(400).json({ success: false, message: 'Missing MOMO secrets' });
    }

    // Rebuild signature string (per MoMo IPN spec)
    const fields = [
      ['accessKey', MOMO_ACCESS_KEY],
      ['amount', body.amount],
      ['extraData', body.extraData || ''],
      ['message', body.message || ''],
      ['orderId', body.orderId],
      ['orderInfo', body.orderInfo || ''],
      ['orderType', body.orderType || 'momo_wallet'],
      ['partnerCode', body.partnerCode],
      ['payType', body.payType || ''],
      ['requestId', body.requestId],
      ['responseTime', body.responseTime],
      ['resultCode', body.resultCode],
      ['transId', body.transId],
    ];
    const raw = fields.map(([k, v]) => `${k}=${v ?? ''}`).join('&');
    const computed = crypto.createHmac('sha256', MOMO_SECRET_KEY).update(raw).digest('hex');
    const provided = String(body.signature || '').toLowerCase();
    const okSig = provided === String(computed).toLowerCase();
    if (!okSig) {
      // Try a leaner variant (some channels omit message/orderType/payType)
      const altFields = [
        ['accessKey', MOMO_ACCESS_KEY],
        ['amount', body.amount],
        ['extraData', body.extraData || ''],
        ['orderId', body.orderId],
        ['orderInfo', body.orderInfo || ''],
        ['partnerCode', body.partnerCode],
        ['requestId', body.requestId],
        ['responseTime', body.responseTime],
        ['resultCode', body.resultCode],
        ['transId', body.transId],
      ];
      const raw2 = altFields.map(([k, v]) => `${k}=${v ?? ''}`).join('&');
      const computed2 = crypto.createHmac('sha256', MOMO_SECRET_KEY).update(raw2).digest('hex');
      if (provided !== String(computed2).toLowerCase()) {
        return res.status(400).json({ success: false, message: 'Invalid signature' });
      }
    }

    const orderCode = String(body.orderId || '');
    const resultCode = Number(body.resultCode);
    const amount = Number(body.amount || 0);

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
      console.warn('MoMo webhook order not found:', orderCode);
      processedOrderCodes.add(String(orderCode));
      return res.status(200).json({ success: true, message: 'Order not found, ignored' });
    }

    if (resultCode === 0) {
      order.status = 'paid';
      order.paidAt = new Date().toISOString();
      orders.set(String(orderCode), order);
      if (order.userId && /^TOPUP-/i.test(order.description || '')) {
        const current = Number(userBalances.get(String(order.userId)) || 0);
        userBalances.set(String(order.userId), current + Number(amount));
      }
    } else {
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

// Health (GET) for providers that validate webhook by GET (MoMo)
app.get('/api/payments/momo', (_req, res) => {
  return res.status(200).json({ success: true, message: 'MoMo webhook is alive. Use POST to deliver events.' });
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


