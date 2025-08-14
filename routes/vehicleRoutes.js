const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Vehicle = require('../models/Vehicle');

// Admin-only simple middleware
const adminOnly = (req, res, next) => {
  if (req.user && req.user.vaiTro === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin only' });
};

router.get('/', protect, adminOnly, async (req, res) => {
  const list = await Vehicle.find().sort({ createdAt: -1 });
  res.json({ success: true, data: list });
});

router.post('/', protect, adminOnly, async (req, res) => {
  const v = await Vehicle.create(req.body);
  res.status(201).json({ success: true, data: v });
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  const v = await Vehicle.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data: v });
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  await Vehicle.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;


