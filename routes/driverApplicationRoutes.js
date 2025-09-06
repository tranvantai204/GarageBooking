const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const DriverApplication = require('../models/DriverApplication');
const User = require('../models/User');

// Submit application (user)
router.post('/', protect, async (req, res) => {
  try {
    const { hoTen, soDienThoai, email, gplxUrl, cccdUrl, note } = req.body || {};
    if (!hoTen || !soDienThoai || !gplxUrl || !cccdUrl) {
      return res.status(400).json({ success: false, message: 'Thiếu dữ liệu bắt buộc' });
    }
    const exists = await DriverApplication.findOne({ userId: req.user.id, status: 'pending' });
    if (exists) return res.status(400).json({ success: false, message: 'Bạn đã gửi đơn và đang chờ duyệt' });
    const app = await DriverApplication.create({
      userId: req.user.id,
      hoTen,
      soDienThoai,
      email: email || '',
      gplxUrl,
      cccdUrl,
      note: note || '',
      status: 'pending',
    });
    res.status(201).json({ success: true, data: app });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: e.message });
  }
});

// List applications (admin)
router.get('/', protect, async (req, res) => {
  try {
    if (req.user.vaiTro !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const items = await DriverApplication.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, items });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: e.message });
  }
});

// Approve application (admin)
router.post('/:id/approve', protect, async (req, res) => {
  try {
    if (req.user.vaiTro !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const app = await DriverApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn' });
    if (app.status !== 'pending') return res.status(400).json({ success: false, message: 'Đơn đã được xử lý' });
    app.status = 'approved';
    app.reviewedBy = req.user.id;
    app.reviewedAt = new Date();
    await app.save();
    // Update user role to driver
    await User.findByIdAndUpdate(app.userId, { vaiTro: 'driver' });
    res.json({ success: true, message: 'Đã duyệt làm tài xế', data: app });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: e.message });
  }
});

// Reject application (admin)
router.post('/:id/reject', protect, async (req, res) => {
  try {
    if (req.user.vaiTro !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
    const app = await DriverApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn' });
    if (app.status !== 'pending') return res.status(400).json({ success: false, message: 'Đơn đã được xử lý' });
    app.status = 'rejected';
    app.reviewedBy = req.user.id;
    app.reviewedAt = new Date();
    await app.save();
    res.json({ success: true, message: 'Đã từ chối đơn', data: app });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: e.message });
  }
});

module.exports = router;


