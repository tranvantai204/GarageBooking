// File: controllers/bookingController.js
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');

// @desc    Tạo lượt đặt vé mới
// @route   POST /api/bookings
// @access  Private
exports.createBooking = async (req, res) => {
  const { tripId, danhSachGheDat } = req.body; // danhSachGheDat là mảng ghế user muốn đặt, ví dụ: ['A1', 'A2']

  try {
    // 1. Tìm chuyến đi trong DB
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi' });
    }

    let tongTien = 0;
    const gheHopLe = []; // Lưu các object ghế hợp lệ để xử lý

    // 2. Kiểm tra xem các ghế được yêu cầu có còn trống không
    trip.danhSachGhe.forEach(seat => {
      // Nếu tên ghế nằm trong danh sách user muốn đặt VÀ ghế đó đang trống
      if (danhSachGheDat.includes(seat.tenGhe) && seat.trangThai === 'trong') {
        gheHopLe.push(seat);
        tongTien += seat.giaVe;
      }
    });

    // 3. Nếu số ghế hợp lệ không bằng số ghế user muốn đặt -> có ghế đã bị đặt hoặc không tồn tại
    if (gheHopLe.length !== danhSachGheDat.length) {
      return res.status(400).json({ success: false, message: 'Một hoặc nhiều ghế đã được đặt hoặc không hợp lệ. Vui lòng thử lại.' });
    }

    // 4. Nếu mọi thứ OK, cập nhật trạng thái các ghế đó thành 'da_dat'
    gheHopLe.forEach(seat => {
      const seatInTrip = trip.danhSachGhe.find(s => s.tenGhe === seat.tenGhe);
      seatInTrip.trangThai = 'da_dat';
    });

    // 5. Lưu lại thông tin chuyến đi đã được cập nhật
    await trip.save();

    // 6. Tạo một bản ghi booking mới
    const booking = await Booking.create({
      tripId,
      userId: req.user._id, // Lấy userId từ middleware 'protect' đã gắn vào req
      danhSachGhe: danhSachGheDat,
      tongTien,
      maVe: `HAPHUONG-${Date.now()}` // Tạo mã vé đơn giản
    });

    res.status(201).json({ success: true, data: booking });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};

// @desc    Lấy lịch sử đặt vé của tôi
// @route   GET /api/bookings/mybookings
// @access  Private
exports.getMyBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ userId: req.user._id }).populate('tripId', 'diemDi diemDen thoiGianKhoiHanh');
        res.status(200).json({ success: true, count: bookings.length, data: bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
}