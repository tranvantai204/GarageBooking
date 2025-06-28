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

// @desc    Hủy vé
// @route   DELETE /api/bookings/:id
// @access  Private
exports.cancelBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;

        // 1. Tìm booking
        const booking = await Booking.findById(bookingId).populate('tripId');

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy vé' });
        }

        // 2. Kiểm tra quyền sở hữu (chỉ user đặt vé hoặc admin mới được hủy)
        if (booking.userId.toString() !== req.user._id.toString() && req.user.vaiTro !== 'admin') {
            return res.status(403).json({ success: false, message: 'Không có quyền hủy vé này' });
        }

        // 3. Kiểm tra thời gian (chỉ được hủy trước 2 giờ khởi hành)
        const now = new Date();
        const departureTime = new Date(booking.tripId.thoiGianKhoiHanh);
        const timeDiff = departureTime.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 3600);

        if (hoursDiff < 2 && req.user.vaiTro !== 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Chỉ có thể hủy vé trước 2 giờ khởi hành'
            });
        }

        // 4. Kiểm tra trạng thái vé (chỉ hủy được vé chưa thanh toán hoặc admin có thể hủy tất cả)
        if (booking.trangThaiThanhToan === 'da_thanh_toan' && req.user.vaiTro !== 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Không thể hủy vé đã thanh toán. Vui lòng liên hệ nhà xe.'
            });
        }

        // 5. Cập nhật lại ghế trong chuyến đi (trả ghế về trạng thái 'trong')
        const trip = booking.tripId;
        booking.danhSachGhe.forEach(tenGhe => {
            const seat = trip.danhSachGhe.find(s => s.tenGhe === tenGhe);
            if (seat) {
                seat.trangThai = 'trong';
            }
        });

        await trip.save();

        // 6. Xóa booking
        await Booking.findByIdAndDelete(bookingId);

        res.status(200).json({
            success: true,
            message: 'Hủy vé thành công',
            data: {
                cancelledBooking: booking,
                refundAmount: booking.trangThaiThanhToan === 'da_thanh_toan' ? booking.tongTien : 0
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
}