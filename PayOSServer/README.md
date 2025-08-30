# PayOS + Express Minimal Integration (ESM)

Dự án mẫu tích hợp PayOS với Express (ES Modules), gồm webhook xác thực chữ ký và hàm tạo link thanh toán.

## Cài đặt

```bash
npm install
# Tạo file .env từ mẫu và điền khóa thật
# cp .env.example .env
npm run dev
```

Server chạy tại: `http://localhost:3000`

## Webhook URL
Cấu hình trong PayOS: `https://garagebooking.onrender.com/api/payments/payos`

## Tạo link thanh toán (Node REPL/route tự viết)
```js
import { createPaymentLink } from './payment.js';
const link = await createPaymentLink(12345, 50000, 'Thanh toán đơn 12345');
console.log(link);
```

## Test webhook bằng curl (signature mẫu chỉ là placeholder)
```bash
curl -X POST http://localhost:3000/api/payments/payos \
  -H "Content-Type: application/json" \
  -d '{
    "code":"00",
    "desc":"success",
    "success":true,
    "data":{
      "orderCode":12345,
      "amount":50000,
      "code":"00",
      "desc":"Giao dịch thành công"
    },
    "signature":"<chu_ky_hop_le>"
  }'
```

Khi chữ ký hợp lệ và giao dịch thành công, server sẽ log:
```
✅ Thanh toán thành công - orderCode=12345, amount=50000
```

Ghi chú: Trong production, thay vì `Set`, hãy lưu idempotency vào DB.


