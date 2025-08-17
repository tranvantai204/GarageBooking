const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Feedback = require('../models/Feedback');
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');

// Create feedback (user)
router.post('/', protect, async (req, res) => {
  try {
    const payload = { ...req.body, userId: req.user._id };
    // Derive driverId if missing using bookingId -> trip -> taiXeId
    if (!payload.driverId && payload.bookingId) {
      const b = await Booking.findById(payload.bookingId).populate('tripId', 'taiXeId');
      payload.driverId = b?.tripId?.taiXeId;
    }
    if (!payload.driverId && payload.tripId) {
      const t = await Trip.findById(payload.tripId);
      payload.driverId = t?.taiXeId;
    }
    const fb = await Feedback.create(payload);
    res.status(201).json({ success: true, data: fb });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// List feedbacks (admin)
router.get('/', protect, async (req, res) => {
  if (req.user.vaiTro !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
  const list = await Feedback.find().sort({ createdAt: -1 });
  res.json({ success: true, data: list });
});

// Update status or edit (admin)
router.put('/:id', protect, async (req, res) => {
  if (req.user.vaiTro !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
  const fb = await Feedback.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data: fb });
});

// Delete (admin)
router.delete('/:id', protect, async (req, res) => {
  if (req.user.vaiTro !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
  await Feedback.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Public summary by driver
router.get('/driver/:driverId/summary', async (req, res) => {
  try {
    const { driverId } = req.params;
    const items = await Feedback.find({ driverId, ratingDriver: { $gte: 1 } })
      .sort({ createdAt: -1 })
      .limit(50);
    const count = await Feedback.countDocuments({ driverId, ratingDriver: { $gte: 1 } });
    const avgAgg = await Feedback.aggregate([
      { $match: { driverId: new (require('mongoose').Types.ObjectId)(driverId), ratingDriver: { $gte: 1 } } },
      { $group: { _id: '$driverId', avg: { $avg: '$ratingDriver' }, count: { $sum: 1 } } }
    ]);
    const avg = avgAgg[0]?.avg || 0;
    res.json({ success: true, data: { avg, count, items } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;


