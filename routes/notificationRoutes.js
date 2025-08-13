const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const PushToken = require('../models/PushToken');

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


