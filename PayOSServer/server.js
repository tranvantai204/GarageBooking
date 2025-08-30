// server.js
// Express server tích hợp PayOS (ES Modules)
// - Đọc biến môi trường từ .env
// - Xác thực chữ ký webhook PayOS bằng SDK @payos/node
// - Chống xử lý lặp bằng Set (idempotent)

import 'dotenv/config';
import express from 'express';
import PayOS from '@payos/node';

const { PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY } = process.env;

// Khởi tạo PayOS client
const payos = new PayOS(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY);

const app = express();

// Lưu raw body để một số luồng xác thực cần dùng, đồng thời vẫn parse JSON
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf.toString(); }
}));

// Bộ nhớ tạm để chống xử lý lại cùng một đơn hàng
const processedOrders = new Set();

// Webhook từ PayOS
app.post('/api/payments/payos', (req, res) => {
  try {
    // Xác thực chữ ký bằng SDK (ném lỗi nếu không hợp lệ)
    payos.webhooks.verify(req.body);

    const body = req.body || {};
    const code = String(body.code ?? '');
    const data = body.data || {};
    const innerCode = String(data.code ?? '');
    const orderCode = data.orderCode ?? data.order_code ?? data.id;
    const amount = Number(data.amount ?? data.orderAmount ?? 0);

    if (code === '00' && innerCode === '00') {
      if (processedOrders.has(orderCode)) {
        return res.status(200).json({ success: true, message: 'Already processed' });
      }
      processedOrders.add(orderCode);
      console.log(`✅ Thanh toán thành công - orderCode=${orderCode}, amount=${amount}`);
      // TODO: cập nhật DB/đơn hàng ở đây
    } else {
      console.log('⚠️ Webhook nhận nhưng chưa success:', { code, innerCode, orderCode, amount });
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ Invalid signature or webhook error:', err?.message || err);
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }
});

// Health check
app.get('/', (_req, res) => res.send('PayOS Webhook Server is running'));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});


