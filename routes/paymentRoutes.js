const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Booking = require('../models/Booking');
const User = require('../models/User');
const WalletTx = require('../models/WalletTransaction');
const PushToken = require('../models/PushToken');
const admin = require('../init_fcm');

/**
 * Internal helper to process a single transaction payload
 * { description, amount, accountNumber, bankCode, txnId }
 * Returns an object describing the effect (walletTopup / updated / skipped / duplicate)
 */
async function processTransactionPayload(payload) {
  const { description = '', amount, accountNumber, bankCode, txnId } = payload || {};
  const OUR_ACC = (process.env.PAY_ACC || '0585761955').trim();
  const OUR_BANK = (process.env.PAY_BANK || 'MB').trim().toUpperCase();

  if (accountNumber && String(accountNumber) !== OUR_ACC) {
    return { success: true, skipped: true, reason: 'Different account' };
  }
  if (bankCode && String(bankCode).toUpperCase() !== OUR_BANK) {
    // proceed anyway; some providers miss this field
  }

  const desc = String(description || '');
  const normalized = desc.toUpperCase().replace(/\s+/g, '');

  // TOPUP by MongoId
  const topupByUserId = normalized.match(/TOPUP-?([A-F0-9]{24})/);
  if (topupByUserId) {
    const txRef = String(txnId || '').trim();
    if (txRef) {
      const exists = await WalletTx.findOne({ type: 'topup', ref: txRef }).lean();
      if (exists) return { success: true, duplicate: true, type: 'topup', ref: txRef };
    }
    const userId = topupByUserId[1].toLowerCase();
    const paid = parseInt(amount, 10) || 0;
    const user = await User.findById(userId);
    if (!user) return { success: true, skipped: true, reason: 'User not found for topup' };
    user.viSoDu = (user.viSoDu || 0) + paid;
    await user.save();
    try { await WalletTx.create({ userId, type: 'topup', amount: paid, ref: String(txnId || '') }); } catch (e) {
      if (e?.code === 11000) return { success: true, duplicate: true, type: 'topup', ref: String(txnId || '') };
      throw e;
    }
    try {
      const tokenDoc = await PushToken.findOne({ userId });
      const token = tokenDoc?.token;
      if (token) {
        await admin.messaging().send({
          token,
          notification: { title: 'Nạp ví thành công', body: `+${paid}đ vào ví` },
          data: { type: 'wallet_topup', amount: String(paid) },
          android: { priority: 'high', notification: { channelId: 'general_notifications', priority: 'high' } },
        });
      }
    } catch (_) {}
    return { success: true, walletTopup: true, via: 'userId', balance: user.viSoDu };
  }

  // TOPUP by phone
  const topupByPhone = normalized.match(/TOPUP-?(\+?84|0)?(\d{9,10})/);
  if (topupByPhone) {
    const txRef = String(txnId || '').trim();
    if (txRef) {
      const exists = await WalletTx.findOne({ type: 'topup', ref: txRef }).lean();
      if (exists) return { success: true, duplicate: true, type: 'topup', ref: txRef };
    }
    const prefix = topupByPhone[1] || '';
    const digits = topupByPhone[2] || '';
    let phone = digits;
    phone = '0' + digits.slice(-9); // normalize to leading 0
    const paid = parseInt(amount, 10) || 0;
    const user = await User.findOne({ soDienThoai: phone });
    if (!user) return { success: true, skipped: true, reason: 'User phone not found', phone };
    user.viSoDu = (user.viSoDu || 0) + paid;
    await user.save();
    try { await WalletTx.create({ userId: user._id, type: 'topup', amount: paid, ref: txRef || '' }); } catch (e) {
      if (e?.code === 11000) return { success: true, duplicate: true, type: 'topup', ref: txRef };
      throw e;
    }
    try {
      const tokenDoc = await PushToken.findOne({ userId: user._id });
      const token = tokenDoc?.token;
      if (token) {
        await admin.messaging().send({
          token,
          notification: { title: 'Nạp ví thành công', body: `+${paid}đ vào ví` },
          data: { type: 'wallet_topup', amount: String(paid) },
          android: { priority: 'high', notification: { channelId: 'general_notifications', priority: 'high' } },
        });
      }
    } catch (_) {}
    return { success: true, walletTopup: true, via: 'phone', phone, balance: user.viSoDu };
  }

  // BOOK-<maVe>
  const match = normalized.match(/BOOK-([A-Z0-9\-]+)/);
  if (!match) return { success: true, skipped: true, reason: 'No booking code or recognizable TOPUP tag' };
  const maVe = match[1];
  const booking = await Booking.findOne({ maVe });
  if (!booking) return { success: true, skipped: true, reason: 'Booking not found' };
  if (booking.trangThaiThanhToan === 'da_thanh_toan') return { success: true, alreadyPaid: true };
  const paid = parseInt(amount, 10) || 0;
  const expected = parseInt(booking.tongTien, 10) || 0;
  if (Math.abs(paid - expected) > 2000) return { success: true, skipped: true, reason: 'Amount mismatch' };
  const txRef = String(txnId || '').trim();
  if (txRef) {
    const exists = await WalletTx.findOne({ type: 'payment', ref: txRef }).lean();
    if (exists) return { success: true, duplicate: true, type: 'payment', ref: txRef };
  }
  booking.trangThaiThanhToan = 'da_thanh_toan';
  booking.paymentMethod = 'bank';
  booking.paymentRef = txRef.slice(0, 128);
  booking.paidAt = new Date();
  await booking.save();
  try { await WalletTx.create({ userId: booking.userId, type: 'payment', amount: paid, ref: txRef || '' }); } catch (e) {
    if (e?.code === 11000) return { success: true, duplicate: true, type: 'payment', ref: txRef };
    throw e;
  }
  try {
    const tokenDoc = await PushToken.findOne({ userId: booking.userId });
    const token = tokenDoc?.token;
    if (token) {
      await admin.messaging().send({
        token,
        notification: { title: 'Thanh toán thành công', body: `Vé ${booking.maVe} đã thanh toán` },
        data: { type: 'booking_paid', bookingId: String(booking._id), maVe },
        android: { priority: 'high', notification: { channelId: 'general_notifications', priority: 'high' } },
      });
    }
  } catch (_) {}
  return { success: true, updated: true, maVe };
}

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
      const r = await processTransactionPayload({ description, amount, accountNumber, bankCode, txnId });
      return res.json(r);
    }
    const r = await processTransactionPayload({ description, amount, accountNumber, bankCode, txnId });
    return res.json(r);
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Manual sync with Casso API (when webhook not available)
router.post('/casso/sync', async (req, res) => {
  try {
    const apiKey = process.env.CASSO_API_KEY || req.body.apiKey;
    if (!apiKey) return res.status(400).json({ success: false, message: 'Missing CASSO_API_KEY' });
    const pageSize = parseInt(req.body.pageSize, 10) || 100;
    const url = `https://oauth.casso.vn/v2/transactions?pageSize=${pageSize}&sort=DESC`;
    const resp = await fetch(url, { headers: { Authorization: `Apikey ${apiKey}` } });
    const json = await resp.json();
    const list = json?.data?.records || json?.data || json?.records || [];
    let processed = 0, updated = 0, topups = 0, duplicates = 0;
    for (const t of list) {
      const payload = {
        description: t.description || t.content || t.remark || '',
        amount: t.amount || t.creditAmount || t.debitAmount || 0,
        accountNumber: t.accountNumber || t.account || '',
        bankCode: t.bankShortName || t.bankCode || '',
        txnId: t.id || t.transactionID || t.transactionId || t.reference || '',
      };
      try {
        const r = await processTransactionPayload(payload);
        processed += 1;
        if (r.walletTopup) topups += 1;
        if (r.updated) updated += 1;
        if (r.duplicate) duplicates += 1;
        // trimmed: removed optional Discord posting
      } catch (_) {}
    }
    return res.json({ success: true, processed, updated, topups, duplicates });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Create payment QR (VietQR image URL)
// Body: { type: 'booking' | 'topup', bookingId?, amount?, userId? }
router.post('/qr', async (req, res) => {
  try {
    const { type = 'booking', bookingId, amount, userId } = req.body || {};
    const bankCode = (process.env.PAY_BANK || 'MB').trim();
    const accountNumber = (process.env.PAY_ACC || '0585761955').trim();
    const accountName = encodeURIComponent(process.env.PAY_ACC_NAME || 'TRAN VAN TAI');

    let finalAmount = parseInt(amount, 10) || 0;
    let addInfo = '';

    if (type === 'booking') {
      if (!bookingId) return res.status(400).json({ success: false, message: 'Thiếu bookingId' });
      const booking = await Booking.findById(bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy vé' });
      addInfo = `BOOK-${booking.maVe}`;
      if (!finalAmount) finalAmount = parseInt(booking.tongTien, 10) || 0;
    } else {
      const uid = String(userId || req.user?._id || '');
      if (!uid) return res.status(400).json({ success: false, message: 'Thiếu userId' });
      addInfo = `TOPUP-${uid}`;
      if (!finalAmount) finalAmount = 0;
    }

    const qrImageUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-qr_only.png?accountName=${accountName}&amount=${finalAmount}&addInfo=${encodeURIComponent(addInfo)}`;

    return res.json({
      success: true,
      data: {
        qrImageUrl,
        addInfo,
        amount: finalAmount,
        payTo: { bankCode, accountNumber, accountName: decodeURIComponent(accountName) },
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ===== PayOS integration =====
// Create payment link
router.post('/payos/create-link', async (req, res) => {
  try {
    const clientId = process.env.PAYOS_CLIENT_ID;
    const apiKey = process.env.PAYOS_API_KEY;
    if (!clientId || !apiKey) return res.status(400).json({ success: false, message: 'Missing PAYOS_CLIENT_ID or PAYOS_API_KEY' });

    const { type = 'booking', bookingId, userId, amount } = req.body || {};
    let finalAmount = parseInt(amount, 10) || 0;
    let addInfo = '';
    if (type === 'booking') {
      if (!bookingId) return res.status(400).json({ success: false, message: 'Thiếu bookingId' });
      const booking = await Booking.findById(bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy vé' });
      addInfo = `BOOK-${booking.maVe}`;
      if (!finalAmount) finalAmount = parseInt(booking.tongTien, 10) || 0;
    } else {
      const uid = String(userId || '');
      if (!uid) return res.status(400).json({ success: false, message: 'Thiếu userId' });
      addInfo = `TOPUP-${uid}`;
      if (!finalAmount) finalAmount = 0;
    }

    const orderCode = Date.now();
    const returnUrl = process.env.PAYOS_RETURN_URL || 'https://garagebooking.onrender.com/payos/return';
    const cancelUrl = process.env.PAYOS_CANCEL_URL || 'https://garagebooking.onrender.com/payos/cancel';

    const payload = {
      orderCode,
      amount: finalAmount,
      description: addInfo,
      returnUrl,
      cancelUrl,
      webhookUrl: process.env.PAYOS_WEBHOOK_URL || undefined,
    };

    // Attempt 1: call without signature
    const endpoint = process.env.PAYOS_API_ENDPOINT || 'https://api-merchant.payos.vn/v2/payment-requests';
    const callPayos = async (body) => {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientId,
          'x-api-key': apiKey,
        },
        body: JSON.stringify(body),
      });
      const raw = await r.text();
      let json = {};
      try { json = JSON.parse(raw || '{}'); } catch (_) {}
      return { ok: r.ok, status: r.status, json, raw };
    };

    let attempt1 = await callPayos(payload);
    let checkoutUrl = attempt1.json?.data?.checkoutUrl || attempt1.json?.checkoutUrl;
    if (attempt1.ok && checkoutUrl) {
      return res.json({ success: true, data: { checkoutUrl, orderCode, addInfo, amount: finalAmount } });
    }

    // Attempt 2: if checksum is configured, try signing with an alternative formula
    let attempt2 = null;
    try {
      const checksumKey = process.env.PAYOS_CHECKSUM_KEY || process.env.PAYOS_CHECKSUM || process.env.CHECKSUM_KEY;
      if (checksumKey) {
        const altPayload = { ...payload };
        const base = `${String(clientId)}|${String(orderCode)}|${String(finalAmount)}|${String(addInfo)}|${String(returnUrl)}|${String(cancelUrl)}|${String(process.env.PAYOS_WEBHOOK_URL || '')}`;
        altPayload.signature = crypto.createHmac('sha256', checksumKey).update(base).digest('hex');
        attempt2 = await callPayos(altPayload);
        checkoutUrl = attempt2.json?.data?.checkoutUrl || attempt2.json?.checkoutUrl;
        if (attempt2.ok && checkoutUrl) {
          return res.json({ success: true, data: { checkoutUrl, orderCode, addInfo, amount: finalAmount } });
        }
      }
    } catch (_) {}

    // Both attempts failed
    return res.status(400).json({
      success: false,
      message: (attempt1?.json?.message || attempt2?.json?.message || 'PayOS create link failed'),
      details: {
        endpoint,
        attempt1: { status: attempt1?.status, body: attempt1?.json || attempt1?.raw },
        attempt2: attempt2 ? { status: attempt2?.status, body: attempt2?.json || attempt2?.raw } : null,
      },
      request: payload,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Diagnostics: expose presence of envs without leaking secrets
router.get('/payos/debug', (req, res) => {
  try {
    const redact = (v) => (v ? `${String(v).slice(0, 3)}...${String(v).slice(-3)}` : null);
    return res.json({
      success: true,
      data: {
        hasClientId: !!process.env.PAYOS_CLIENT_ID,
        hasApiKey: !!process.env.PAYOS_API_KEY,
        hasChecksum: !!(process.env.PAYOS_CHECKSUM_KEY || process.env.PAYOS_CHECKSUM || process.env.CHECKSUM_KEY),
        endpoint: process.env.PAYOS_API_ENDPOINT || 'https://api-merchant.payos.vn/v2/payment-requests',
        sample: {
          clientId: redact(process.env.PAYOS_CLIENT_ID),
          apiKey: redact(process.env.PAYOS_API_KEY),
        },
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// PayOS webhook (simplified)
router.post('/webhook/payos', async (req, res) => {
  try {
    // In practice, verify signature/checksum from headers. Here we process safely by description/orderCode
    const body = req.body || {};
    const data = body.data || body;
    const description = data.description || data.orderDescription || '';
    const amount = data.amount || data.orderAmount || 0;
    const txnId = data.orderCode || data.id || '';
    const r = await processTransactionPayload({ description, amount, txnId });
    return res.json({ success: true, handled: r });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Alias: Some configurations expect webhook at /api/payments/payos
// This endpoint mirrors the logic of /webhook/payos
router.post('/payos', async (req, res) => {
  try {
    const body = req.body || {};
    const data = body.data || body;
    const description = data.description || data.orderDescription || '';
    const amount = data.amount || data.orderAmount || 0;
    const txnId = data.orderCode || data.id || '';
    const r = await processTransactionPayload({ description, amount, txnId });
    return res.json({ success: true, handled: r });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Health hint for providers that validate webhook by GET
router.get('/payos', (req, res) => {
  return res.status(200).json({ success: true, message: 'PayOS webhook is alive. Use POST to deliver events.' });
});

// trimmed: removed Discord sync route for simplicity

module.exports = router;


