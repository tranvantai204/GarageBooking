const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const User = require('../models/User');

const adminOnly = (req, res, next) => {
  if (req.user && req.user.vaiTro === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin only' });
};

// Overdue tickets: trips departed in the past, not checked-in
router.get('/overdue-bookings', protect, adminOnly, async (req, res) => {
  const now = new Date();
  const trips = await Trip.find({ thoiGianKhoiHanh: { $lt: now } }, { _id: 1 });
  const tripIds = trips.map(t => t._id);
  const overdue = await Booking.find({ tripId: { $in: tripIds }, trangThaiCheckIn: { $ne: 'da_check_in' } })
    .populate('tripId', 'diemDi diemDen thoiGianKhoiHanh')
    .populate('userId', 'hoTen soDienThoai');
  res.json({ success: true, count: overdue.length, data: overdue });
});

module.exports = router;

// Toggle VIP for user
router.post('/users/:id/vip', protect, adminOnly, async (req, res) => {
  const { isVip } = req.body || {};
  const user = await User.findByIdAndUpdate(req.params.id, { isVip: !!isVip }, { new: true });
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: { id: user._id, isVip: user.isVip } });
});


