const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const PushToken = require('../models/PushToken');
const admin = require('../init_fcm');
const AdminNotification = require('../models/AdminNotification');

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
    // Save to Mongo so app can fetch later
    const saved = await AdminNotification.create({
      title: title || 'Thông báo',
      body: body || '',
      data,
      createdBy: { userId: req.user.id, name: req.user.hoTen, role: req.user.vaiTro }
    });

    // Send FCM to all users/drivers
    const message = {
      notification: { title: title || 'Thông báo', body: body || '' },
      data: Object.fromEntries(Object.entries({ ...data, type: 'admin_broadcast', adminNotifId: String(saved._id) }).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high', notification: { channelId: 'general_notifications', priority: 'high' } },
      tokens: tokenList,
    };
    const resp = await admin.messaging().sendEachForMulticast(message);
    res.json({ success: true, sent: resp.successCount, failed: resp.failureCount, id: saved._id });
  } catch (e) {
    console.error('Broadcast error:', e);
    res.status(500).json({ success: false });
  }
});

// List admin notifications (latest first)
router.get('/admin', protect, async (req, res) => {
  try {
    const items = await AdminNotification.find({}).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, items });
  } catch (e) {
    console.error('List admin notifications error:', e);
    res.status(500).json({ success: false });
  }
});

// Delete one admin notification
router.delete('/admin/:id', protect, async (req, res) => {
  try {
    if (!req.user || req.user.vaiTro !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
    await AdminNotification.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    console.error('Delete admin notification error:', e);
    res.status(500).json({ success: false });
  }
});

// Update one admin notification
router.put('/admin/:id', protect, async (req, res) => {
  try {
    if (!req.user || req.user.vaiTro !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }
    const { title, body, data = {} } = req.body || {};
    const updated = await AdminNotification.findByIdAndUpdate(
      req.params.id,
      { title, body, data },
      { new: true }
    );
    res.json({ success: true, item: updated });
  } catch (e) {
    console.error('Update admin notification error:', e);
    res.status(500).json({ success: false });
  }
});


