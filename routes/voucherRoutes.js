const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Voucher = require('../models/Voucher');

const adminOnly = (req, res, next) => {
  if (req.user && req.user.vaiTro === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin only' });
};

router.get('/', protect, adminOnly, async (req, res) => {
  const list = await Voucher.find().sort({ createdAt: -1 });
  res.json({ success: true, data: list });
});

router.post('/', protect, adminOnly, async (req, res) => {
  const v = await Voucher.create(req.body);
  res.status(201).json({ success: true, data: v });
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  const v = await Voucher.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data: v });
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  await Voucher.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// Validate voucher for booking
router.post('/validate', protect, async (req, res) => {
  const { code, amount, route } = req.body || {};
  const v = await Voucher.findOne({ code, active: true });
  if (!v) {
    return res.status(400).json({ success: false, message: 'Voucher không hợp lệ' });
  }
  const now = new Date();
  const start = new Date(v.startAt);
  const end = new Date(v.endAt);
  // So sánh theo ngày, bao gồm cả ngày bắt đầu/kết thúc để tránh lệch múi giờ
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  if (now < start || now > end) {
    return res.status(400).json({ success: false, message: 'Voucher hết hạn hoặc chưa hiệu lực' });
  }
  if (v.onlyVip && !req.user.isVip) {
    return res.status(403).json({ success: false, message: 'Voucher dành cho VIP' });
  }
  if (v.minAmount && amount < v.minAmount) {
    return res.status(400).json({ success: false, message: 'Chưa đạt mức tối thiểu' });
  }
  if (v.routes?.length && route && !v.routes.includes(route)) {
    return res.status(400).json({ success: false, message: 'Không áp dụng tuyến này' });
  }
  let discount = v.type === 'percent' ? (amount * v.value) / 100 : v.value;
  if (v.maxDiscount) discount = Math.min(discount, v.maxDiscount);
  res.json({ success: true, discount });
});

module.exports = router;


