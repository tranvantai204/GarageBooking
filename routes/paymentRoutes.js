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
      const topup = normalized.match(/TOPUP-?([A-F0-9]{24})/);
      if (topup) {
        const userId = topup[1].toLowerCase();
        const paid = parseInt(amount, 10) || 0;
        const user = await User.findById(userId);
        if (!user) return res.json({ success: true, skipped: true, reason: 'User not found for topup' });
        user.viSoDu = (user.viSoDu || 0) + paid;
        await user.save();
        await WalletTx.create({ userId, type: 'topup', amount: paid, ref: txnId || '' });
        return res.json({ success: true, walletTopup: true, balance: user.viSoDu });
      }
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
    try { await WalletTx.create({ userId: booking.userId, type: 'payment', amount: paid, ref: txnId || '' }); } catch (_) {}

    return res.json({ success: true, updated: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;


