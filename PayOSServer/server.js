// server.js
// Express server tích hợp PayOS (ES Modules)
// - Đọc biến môi trường từ .env
// - API: create payment (bank transfer), webhook Casso, get order status
// - Lưu đơn hàng giả lập trong bộ nhớ (in-memory)

import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';

const {
  // Bank transfer config
  PAY_BANK,
  PAY_ACC,
  PAY_ACC_NAME,
  // Casso webhook secret
  CASSO_WEBHOOK_SECRET,
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

// 1) Tạo hướng dẫn chuyển khoản (VietQR + nội dung chuyển khoản duy nhất)
app.post('/api/payments/create', async (req, res) => {
  try {
    const { bookingId, amount, description, userId } = req.body || {};
    if (!amount || Number.isNaN(Number(amount))) {
      return res.status(400).json({ success: false, message: 'amount is required and must be a number' });
    }

    const orderCode = String(Date.now());
    const bankCode = String(PAY_BANK || 'MB');
    const accountNumber = String(PAY_ACC || '0585761955');
    const accountName = String(PAY_ACC_NAME || 'TRAN VAN TAI');
    const addInfo = String(description || `PAY-${orderCode}`);
    const amountVnd = Number(amount);

    const qrImageUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-qr_only.png?accountName=${encodeURIComponent(accountName)}&amount=${amountVnd}&addInfo=${encodeURIComponent(addInfo)}`;

    orders.set(String(orderCode), {
      id: String(orderCode),
      orderCode: String(orderCode),
      bookingId: bookingId || null,
      userId: userId || null,
      amount: amountVnd,
      description: addInfo,
      status: 'pending',
      createdAt: new Date().toISOString(),
      provider: 'casso_bank',
    });

    return res.json({ success: true, data: { orderCode, amount: amountVnd, addInfo, bank: { bankCode, accountNumber, accountName }, qrImageUrl } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Debug: kiểm tra cấu hình ngân hàng/Casso
app.get('/api/payments/debug', (_req, res) => {
  return res.json({
    success: true,
    data: {
      bank: { bankCode: PAY_BANK || 'MB', accountNumber: PAY_ACC || '0585761955', accountName: PAY_ACC_NAME || 'TRAN VAN TAI' },
      hasCassoSecret: !!CASSO_WEBHOOK_SECRET,
    },
  });
});

// 2) Webhook Casso: xác nhận thanh toán theo nội dung chuyển khoản
app.post('/api/payments/casso', async (req, res) => {
  try {
    const provided = String(req.headers['x-webhook-secret'] || req.query.secret || '');
    const secret = String(CASSO_WEBHOOK_SECRET || 'abc123');
    if (!secret || provided !== secret) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const payload = req.body || {};
    const records = Array.isArray(payload.data) ? payload.data : [payload.data || payload];
    let handled = 0;
    for (const tx of records) {
      if (!tx) continue;
      const description = String(tx.description || tx.memo || '').toUpperCase();
      const amount = Number(tx.amount || 0);
      const match = description.match(/PAY-([0-9]{9,13})/);
      const orderCode = match ? match[1] : null;
      if (!orderCode) continue;

      const order = orders.get(String(orderCode));
      if (!order) continue;
      if (processedOrderCodes.has(String(orderCode))) { handled++; continue; }

      if (amount && order.amount && Number(amount) < Number(order.amount)) {
        continue; // ignore underpaid
      }
      order.status = 'paid';
      order.paidAt = new Date().toISOString();
      orders.set(String(orderCode), order);
      processedOrderCodes.add(String(orderCode));
      handled++;
    }

    return res.status(200).json({ success: true, handled });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Health (GET) for providers that validate webhook by GET (Casso)
app.get('/api/payments/casso', (_req, res) => {
  return res.status(200).json({ success: true, message: 'Casso webhook is alive. Use POST to deliver events.' });
});

// 3) Lấy thông tin đơn hàng
app.get('/api/orders/:id', (req, res) => {
  const id = String(req.params.id || '').trim();
  const order = orders.get(id);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
  return res.json({ success: true, data: order });
});

// Health check
app.get('/', (_req, res) => res.send('Bank transfer (Casso) payment server is running'));

const PORT = Number(ENV_PORT || 3000);
app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});


