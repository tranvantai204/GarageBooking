const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const User = require('../models/User');
const WalletTx = require('../models/WalletTransaction');

// Simple webhook to auto-confirm bank transfers (e.g., from Casso)
// Expect body: { description, amount, accountNumber, bankCode, txnId }
// Use header 'x-webhook-secret' or query ?secret= to verify
router.post('/webhook/casso', async (req, res) => {
  try {
    const provided = req.headers['x-webhook-secret'] || req.query.secret || '';
    const secret = process.env.WEBHOOK_SECRET || 'abc123';
    if (!secret || provided !== secret) {
      return res.status(401).json({ success: false, message: 'Invalid secret' });
    }

    const { description = '', amount, accountNumber, bankCode, txnId } = req.body || {};
    const txRef = String(txnId || '').trim();
    // Only process credits to our MB account
    const OUR_ACC = (process.env.PAY_ACC || '0585761955').trim();
    const OUR_BANK = (process.env.PAY_BANK || 'MB').trim().toUpperCase();
    // Some providers may omit accountNumber. If provided and mismatched, skip; if missing, proceed.
    if (accountNumber && String(accountNumber) !== OUR_ACC) {
      return res.json({ success: true, skipped: true, reason: 'Different account' });
    }
    if (bankCode && String(bankCode).toUpperCase() !== OUR_BANK) {
      // still proceed if provider does not send bankCode
    }

    // Extract patterns from description
    // 1) BOOK-<maVe> => mark booking paid
    // 2) TOPUP-<userId24> => add to user's wallet
    const desc = String(description || '');
    const normalized = desc.toUpperCase().replace(/\s+/g, '');
    const match = normalized.match(/BOOK-([A-Z0-9\-]+)/);
    if (!match) {
      // 1) TOPUP-<MongoId>
      const topupByUserId = normalized.match(/TOPUP-?([A-F0-9]{24})/);
      if (topupByUserId) {
        // If we've already processed this txnId as a topup, return idempotent response
        if (txRef) {
          const exists = await WalletTx.findOne({ type: 'topup', ref: txRef }).lean();
          if (exists) return res.json({ success: true, duplicate: true, type: 'topup', ref: txRef });
        }
        const userId = topupByUserId[1].toLowerCase();
        const paid = parseInt(amount, 10) || 0;
        const user = await User.findById(userId);
        if (!user) return res.json({ success: true, skipped: true, reason: 'User not found for topup' });
        user.viSoDu = (user.viSoDu || 0) + paid;
        await user.save();
        try {
          await WalletTx.create({ userId, type: 'topup', amount: paid, ref: txRef || '' });
        } catch (e) {
          if (e?.code === 11000) return res.json({ success: true, duplicate: true, type: 'topup', ref: txRef });
          throw e;
        }
        return res.json({ success: true, walletTopup: true, via: 'userId', balance: user.viSoDu });
      }

      // 2) TOPUP-<phone> (9-11 digits, accepts 0xxxxxxxxx or 84xxxxxxxxx)
      const topupByPhone = normalized.match(/TOPUP-?(\+?84|0)?(\d{9,10})/);
      if (topupByPhone) {
        // If we've already processed this txnId as a topup, return idempotent response
        if (txRef) {
          const exists = await WalletTx.findOne({ type: 'topup', ref: txRef }).lean();
          if (exists) return res.json({ success: true, duplicate: true, type: 'topup', ref: txRef });
        }
        const prefix = topupByPhone[1] || '';
        const digits = topupByPhone[2] || '';
        // Normalize to leading 0
        let phone = digits;
        if (!prefix || prefix === '0') {
          phone = '0' + digits.slice(-9);
        } else {
          // +84 or 84
          phone = '0' + digits.slice(-9);
        }
        const paid = parseInt(amount, 10) || 0;
        const user = await User.findOne({ soDienThoai: phone });
        if (!user) return res.json({ success: true, skipped: true, reason: 'User phone not found', phone });
        user.viSoDu = (user.viSoDu || 0) + paid;
        await user.save();
        try {
          await WalletTx.create({ userId: user._id, type: 'topup', amount: paid, ref: txRef || '' });
        } catch (e) {
          if (e?.code === 11000) return res.json({ success: true, duplicate: true, type: 'topup', ref: txRef });
          throw e;
        }
        return res.json({ success: true, walletTopup: true, via: 'phone', phone, balance: user.viSoDu });
      }

      return res.json({ success: true, skipped: true, reason: 'No booking code or recognizable TOPUP tag' });
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

    // If this payment txnId was processed already, treat as idempotent
    if (txRef) {
      const exists = await WalletTx.findOne({ type: 'payment', ref: txRef }).lean();
      if (exists) return res.json({ success: true, duplicate: true, type: 'payment', ref: txRef });
    }

    booking.trangThaiThanhToan = 'da_thanh_toan';
    booking.paymentMethod = 'bank';
    booking.paymentRef = txRef.slice(0, 128);
    booking.paidAt = new Date();
    await booking.save();
    try { await WalletTx.create({ userId: booking.userId, type: 'payment', amount: paid, ref: txRef || '' }); } catch (e) {
      if (e?.code === 11000) return res.json({ success: true, duplicate: true, type: 'payment', ref: txRef });
      throw e;
    }

    return res.json({ success: true, updated: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;


