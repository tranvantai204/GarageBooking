const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const SystemSetting = require('../models/SystemSetting');

const adminOnly = (req, res, next) => {
  if (req.user && req.user.vaiTro === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin only' });
};

router.get('/', protect, adminOnly, async (req, res) => {
  const list = await SystemSetting.find();
  res.json({ success: true, data: list });
});

router.post('/', protect, adminOnly, async (req, res) => {
  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ success: false, message: 'key required' });
  const s = await SystemSetting.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
  res.status(201).json({ success: true, data: s });
});

module.exports = router;


