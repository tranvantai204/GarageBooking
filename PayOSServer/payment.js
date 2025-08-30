// payment.js
// Hàm tạo link thanh toán PayOS để client dùng

import 'dotenv/config';
import PayOS from '@payos/node';

const {
  PAYOS_CLIENT_ID,
  PAYOS_API_KEY,
  PAYOS_CHECKSUM_KEY,
  PAYOS_RETURN_URL,
  PAYOS_CANCEL_URL,
} = process.env;

const payos = new PayOS(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY);

/**
 * Tạo link thanh toán PayOS
 * @param {number|string} orderCode - Mã đơn
 * @param {number} amount - Số tiền VND
 * @param {string} description - Nội dung
 * @returns {Promise<string>} checkoutUrl
 */
export async function createPaymentLink(orderCode, amount, description) {
  if (!amount || Number.isNaN(Number(amount))) {
    throw new Error('amount is required and must be a number');
  }
  const safeOrderCode = Number(orderCode) || Date.now();

  const payload = {
    orderCode: safeOrderCode,
    amount: Number(amount),
    description: description || `ORDER-${safeOrderCode}`,
    returnUrl: PAYOS_RETURN_URL || 'https://garagebooking.onrender.com/payos/return',
    cancelUrl: PAYOS_CANCEL_URL || 'https://garagebooking.onrender.com/payos/cancel',
  };

  const resp = await payos.createPaymentLink(payload);
  const checkoutUrl = resp?.data?.checkoutUrl || resp?.checkoutUrl;
  if (!checkoutUrl) {
    throw new Error(`Create payment link failed: ${JSON.stringify(resp)}`);
  }
  return checkoutUrl;
}


