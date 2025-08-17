const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');

// Simple webhook to auto-confirm bank transfers (e.g., from Casso)
// Expect body: { description, amount, accountNumber, bankCode, txnId }
// Use header 'x-webhook-secret' or query ?secret= to verify
router.post('/webhook/casso', async (req, res) => {
  try {
    const provided = req.headers['x-webhook-secret'] || req.query.secret || '';
    const secret = process.env.WEBHOOK_SECRET || 'CHANGE_ME_SECRET';
    if (!secret || provided !== secret) {
      return res.status(401).json({ success: false, message: 'Invalid secret' });
    }

    const { description = '', amount, accountNumber, bankCode, txnId } = req.body || {};
    // Only process credits to our MB account
    const OUR_ACC = (process.env.PAY_ACC || '0585761955').trim();
    const OUR_BANK = (process.env.PAY_BANK || 'MB').trim().toUpperCase();
    if (!accountNumber || String(accountNumber) !== OUR_ACC) {
      return res.json({ success: true, skipped: true });
    }
    if (bankCode && String(bankCode).toUpperCase() !== OUR_BANK) {
      // still proceed if provider does not send bankCode
    }

    // Extract booking code: BOOK-<maVe>
    const match = String(description).match(/BOOK-([A-Za-z0-9\-]+)/);
    if (!match) {
      return res.json({ success: true, skipped: true, reason: 'No booking code' });
    }
    const maVe = match[1];
    const booking = await Booking.findOne({ maVe });
    if (!booking) {
      return res.json({ success: true, skipped: true, reason: 'Booking not found' });
    }
    if (booking.trangThaiThanhToan === 'da_thanh_toan') {
      return res.json({ success: true, alreadyPaid: true });
    }
    // Amount check (allow small delta)
    const paid = parseInt(amount, 10) || 0;
    const expected = parseInt(booking.tongTien, 10) || 0;
    if (Math.abs(paid - expected) > 2000) {
      return res.json({ success: true, skipped: true, reason: 'Amount mismatch' });
    }

    booking.trangThaiThanhToan = 'da_thanh_toan';
    booking.paymentMethod = 'bank';
    booking.paymentRef = String(txnId || '').slice(0, 128);
    booking.paidAt = new Date();
    await booking.save();

    return res.json({ success: true, updated: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;


