const express = require('express');
const router = express.Router();
const Refund = require('../models/RefundRequest');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');

// Apply protect middleware to all refund routes
router.use(protect);

// Create refund request (user)
router.post('/', async (req, res) => {
  try {
    const { bookingId, reason, method } = req.body || {};
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy vé' });
    if (booking.userId.toString() !== req.user._id.toString() && req.user.vaiTro !== 'admin') {
      return res.status(403).json({ success: false, message: 'Không có quyền yêu cầu hoàn tiền' });
    }
    if (booking.trangThaiThanhToan !== 'da_thanh_toan') {
      return res.status(400).json({ success: false, message: 'Vé chưa thanh toán không thể hoàn' });
    }
    const exists = await Refund.findOne({ bookingId, status: 'pending' });
    if (exists) return res.json({ success: true, data: exists });
    const rr = await Refund.create({
      bookingId,
      userId: booking.userId,
      amount: booking.tongTien,
      reason: reason || '',
      method: method === 'bank' ? 'bank' : 'wallet',
    });
    res.json({ success: true, data: rr });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// List refund requests (admin)
router.get('/', async (req, res) => {
  try {
    if (req.user.vaiTro !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    const status = req.query.status;
    const filter = status ? { status } : {};
    const items = await Refund.find(filter).sort({ createdAt: -1 }).populate('bookingId', 'maVe tongTien').populate('userId', 'hoTen soDienThoai');
    res.json({ success: true, data: items });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Approve/refuse (admin)
router.put('/:id/approve', async (req, res) => {
  try {
    if (req.user.vaiTro !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    const { id } = req.params;
    const { action } = req.body; // 'approve' | 'reject'
    const rr = await Refund.findById(id);
    if (!rr) return res.status(404).json({ success: false, message: 'Không tìm thấy yêu cầu' });
    if (rr.status !== 'pending') return res.json({ success: true, data: rr });

    if (action === 'approve') {
      // 1. Hoàn tiền vào ví nếu cần
      if (rr.method === 'wallet') {
        const user = await User.findById(rr.userId);
        if (user) {
          user.viSoDu = (user.viSoDu || 0) + rr.amount;
          await user.save();
        }
      }

      // 2. Cập nhật trạng thái vé và giải phóng chỗ
      const booking = await Booking.findById(rr.bookingId).populate('tripId');
      if (booking) {
        const Trip = require('../models/Trip');
        const trip = await Trip.findById(booking.tripId);
        if (trip) {
          booking.danhSachGhe.forEach(tenGhe => {
            const seat = trip.danhSachGhe.find(s => s.tenGhe === tenGhe);
            if (seat) seat.trangThai = 'trong';
          });
          await trip.save();
        }
        // Thay vì xóa, ta chuyển trạng thái sang da_huy để giữ lịch sử
        booking.trangThaiThanhToan = 'da_huy';
        booking.trangThaiCheckIn = 'da_huy';
        await booking.save();
      }

      rr.status = 'approved';
      rr.processedBy = req.user._id;
      rr.processedAt = new Date();
      await rr.save();

      // 3. Gửi thông báo cho người dùng
      try {
        const admin = require('../init_fcm');
        const PushToken = require('../models/PushToken');
        const tokenDoc = await PushToken.findOne({ userId: rr.userId });
        if (tokenDoc) {
          await admin.messaging().send({
            token: tokenDoc.token,
            notification: {
              title: 'Hoàn tiền thành công',
              body: `Bạn đã được hoàn ${rr.amount.toLocaleString()}đ vào ví dư cho vé ${booking?.maVe || ''}`,
            },
            data: { type: 'refund_success', amount: String(rr.amount) }
          });
        }
      } catch (err) {
        console.error('Lỗi gửi thông báo hoàn tiền:', err);
      }

      return res.json({ success: true, data: rr });
    } else {
      rr.status = 'rejected';
      rr.processedBy = req.user._id;
      rr.processedAt = new Date();
      await rr.save();
      return res.json({ success: true, data: rr });
    }
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;


