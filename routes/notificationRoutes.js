const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const PushToken = require('../models/PushToken');
const admin = require('../init_fcm');

router.post('/fcm-token', protect, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) return res.status(400).json({ success: false, message: 'token required' });
    await PushToken.findOneAndUpdate(
      { userId: req.user.id },
      { token },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (e) {
    console.error('Save FCM token error:', e);
    res.status(500).json({ success: false });
  }
});

module.exports = router;

// Broadcast notification (admin only)
router.post('/broadcast', protect, async (req, res) => {
  try {
    if (!req.user || req.user.vaiTro !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
    const { title, body, data = {} } = req.body || {};
    const tokens = await PushToken.find({}, { token: 1, _id: 0 });
    const tokenList = tokens.map(t => t.token).filter(Boolean);
    if (tokenList.length === 0) return res.json({ success: true, sent: 0 });
    const message = {
      notification: { title: title || 'Thông báo', body: body || '' },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high', notification: { channelId: 'incoming_call', priority: 'max' } },
      tokens: tokenList,
    };
    const resp = await admin.messaging().sendEachForMulticast(message);
    res.json({ success: true, sent: resp.successCount, failed: resp.failureCount });
  } catch (e) {
    console.error('Broadcast error:', e);
    res.status(500).json({ success: false });
  }
});


