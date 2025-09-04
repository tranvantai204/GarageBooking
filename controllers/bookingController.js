// File: controllers/bookingController.js
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const QRCode = require('qrcode');
const User = require('../models/User');

// @desc    Tạo lượt đặt vé mới
// @route   POST /api/bookings
// @access  Private
exports.createBooking = async (req, res) => {
  const { tripId, danhSachGheDat, voucherCode, discountAmount, loaiDiemDon, diaChiDon, ghiChuDiemDon, thongTinKhachHang, forPhone } = req.body; // danhSachGheDat là mảng ghế user muốn đặt; forPhone dùng cho tài xế đặt hộ

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
    const maVe = `HAPHUONG-${Date.now()}`;

    // 7. Tạo QR code cho vé
    const qrData = {
      maVe: maVe,
      tripId: tripId,
      userId: req.user._id,
      danhSachGhe: danhSachGheDat,
      tongTien: tongTien,
      timestamp: Date.now()
    };

    const qrCodeString = await QRCode.toDataURL(JSON.stringify(qrData));

    const bookingPayload = {
      tripId,
      userId: req.user._id,
      danhSachGhe: danhSachGheDat,
      tongTien: Math.max(0, tongTien - (parseInt(discountAmount) || 0)),
      maVe: maVe,
      qrCode: qrCodeString,
      loaiDiemDon: loaiDiemDon || 'ben_xe',
      diaChiDon: diaChiDon,
      ghiChuDiemDon: ghiChuDiemDon,
    };
    if (voucherCode) bookingPayload.voucherCode = voucherCode;
    if (discountAmount) bookingPayload.discountAmount = parseInt(discountAmount);
    if (thongTinKhachHang && typeof thongTinKhachHang === 'object') {
      bookingPayload.thongTinKhachHang = thongTinKhachHang;
    }

    // 7.1 Embed vehicle snapshot from trip
    try {
      bookingPayload.vehicleSnapshot = {
        tenXe: trip.vehicleInfo?.tenXe,
        hangXe: trip.vehicleInfo?.hangXe,
        bienSoXe: trip.vehicleInfo?.bienSoXe || trip.bienSoXe,
        hinhAnh: Array.isArray(trip.vehicleInfo?.hinhAnh) ? trip.vehicleInfo.hinhAnh : [],
      };
    } catch (e) {}

    // Nếu tài xế đặt hộ (forPhone), tìm hoặc tạo user theo số điện thoại và gán userId vào vé
    if (forPhone && typeof forPhone === 'string' && forPhone.trim()) {
      const phone = forPhone.trim();
      let user = await User.findOne({ soDienThoai: phone });
      if (!user) {
        user = await User.create({ hoTen: 'Khách lẻ', soDienThoai: phone, matKhau: 'Temp@1234' });
      }
      bookingPayload.userId = user._id;
    }

    const booking = await Booking.create(bookingPayload);

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
        const bookings = await Booking.find({ userId: req.user._id })
          .populate('tripId', 'diemDi diemDen thoiGianKhoiHanh taiXe bienSoXe loaiXe vehicleInfo')
          .sort({ createdAt: -1 });
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

// @desc    Check-in vé bằng QR code
// @route   POST /api/bookings/checkin
// @access  Private (chỉ tài xế và admin)
exports.checkInBooking = async (req, res) => {
    try {
        const { qrData } = req.body;

        // 1. Parse QR data - chấp nhận cả JSON hoặc chỉ maVe (string)
        let parsedData;
        try {
            parsedData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
        } catch (e) {
            // Nếu không phải JSON, coi như qrData là mã vé
            if (typeof qrData === 'string' && qrData.trim()) {
                parsedData = { maVe: qrData.trim() };
            } else {
                return res.status(400).json({ success: false, message: 'QR code không hợp lệ' });
            }
        }

        // 1.1 Chuẩn hóa/khôi phục maVe từ nhiều định dạng khác nhau
        let maVeStr = String(parsedData.maVe || '').trim();
        if (!maVeStr) {
            const rawStr = typeof qrData === 'string' ? qrData : JSON.stringify(parsedData);
            const normalized = String(rawStr || '').toUpperCase().replace(/\s+/g, '');
            let m = normalized.match(/HAPHUONG-?([0-9]{6,20})/);
            if (!m) {
                const m2 = normalized.match(/BOOKHAPHUONG-?([0-9]{6,20})/);
                if (m2) m = m2;
            }
            if (m) {
                maVeStr = `HAPHUONG-${m[1]}`;
            }
        }

        if (!maVeStr) {
            return res.status(400).json({ success: false, message: 'Không tìm thấy mã vé trong QR' });
        }

        // 2. Tìm booking theo mã vé
        // Thử tìm theo maVe chuẩn hóa (có '-') rồi fallback không '-'
        let booking = await Booking.findOne({ maVe: maVeStr })
            .populate('tripId', 'diemDi diemDen thoiGianKhoiHanh taiXe')
            .populate('userId', 'hoTen soDienThoai');

        if (!booking && maVeStr.includes('HAPHUONG-')) {
            const alt = maVeStr.replace('HAPHUONG-', 'HAPHUONG');
            booking = await Booking.findOne({ maVe: alt })
                .populate('tripId', 'diemDi diemDen thoiGianKhoiHanh taiXe')
                .populate('userId', 'hoTen soDienThoai');
        }

        if (!booking) {
            return res.status(404).json({ success: false, message: `Không tìm thấy vé: ${maVeStr}` });
        }

        // 3. Kiểm tra quyền (chỉ tài xế của chuyến đi hoặc admin)
        if (req.user.vaiTro !== 'admin' &&
            req.user.vaiTro !== 'tai_xe') {
            return res.status(403).json({ success: false, message: 'Không có quyền check-in' });
        }

        // 4. Kiểm tra xem vé đã check-in chưa
        if (booking.trangThaiCheckIn === 'da_check_in') {
            return res.status(400).json({
                success: false,
                message: 'Vé đã được check-in trước đó',
                data: {
                    thoiGianCheckIn: booking.thoiGianCheckIn,
                    nguoiCheckIn: booking.nguoiCheckIn
                }
            });
        }

        // 5. Kiểm tra thời gian (chỉ được check-in trong ngày khởi hành)
        const today = new Date();
        const departureDate = new Date(booking.tripId.thoiGianKhoiHanh);

        if (today.toDateString() !== departureDate.toDateString()) {
            return res.status(400).json({
                success: false,
                message: 'Chỉ có thể check-in trong ngày khởi hành'
            });
        }

        // 6. Cập nhật trạng thái check-in
        booking.trangThaiCheckIn = 'da_check_in';
        booking.thoiGianCheckIn = new Date();
        booking.nguoiCheckIn = req.user._id;

        await booking.save();

        res.status(200).json({
            success: true,
            message: 'Check-in thành công',
            data: {
                booking: booking,
                khachHang: booking.userId,
                chuyenDi: booking.tripId
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
}

// @desc    Mark booking as paid
// @route   POST /api/bookings/:id/pay
// @access  Private (cash: driver/admin only, bank: user allowed)
exports.payBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { method, reference } = req.body; // method: 'cash' | 'bank' | 'wallet'
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy vé' });
    // Quyền xác nhận thanh toán:
    // - method 'cash': chỉ 'admin' hoặc 'tai_xe'/'driver' được phép xác nhận
    // - method 'bank': cho phép chủ vé tự xác nhận (tạm thời), admin vẫn có quyền
    const isOwner = booking.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.vaiTro === 'admin';
    const isDriver = req.user.vaiTro === 'tai_xe' || req.user.vaiTro === 'driver';

    if (method === 'cash') {
      if (!(isAdmin || isDriver)) {
        return res.status(403).json({ success: false, message: 'Chỉ tài xế hoặc admin mới được xác nhận tiền mặt' });
      }
    } else if (method === 'wallet') {
      // thanh toán từ ví: chỉ chủ vé hoặc admin
      if (!(isOwner || isAdmin)) {
        return res.status(403).json({ success: false, message: 'Không có quyền thanh toán ví cho vé này' });
      }
      const user = await User.findById(booking.userId);
      if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
      if ((user.viSoDu || 0) < booking.tongTien) {
        return res.status(400).json({ success: false, message: 'Số dư ví không đủ' });
      }
      user.viSoDu = (user.viSoDu || 0) - booking.tongTien;
      await user.save();
    } else {
      // bank
      if (!(isOwner || isAdmin)) {
        return res.status(403).json({ success: false, message: 'Không có quyền thanh toán vé này' });
      }
    }
    booking.trangThaiThanhToan = 'da_thanh_toan';
    booking.paymentMethod = method === 'bank' ? 'bank' : 'cash';
    booking.paymentRef = reference || undefined;
    booking.paidAt = new Date();
    await booking.save();
    res.json({ success: true, message: 'Thanh toán thành công', data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
}

// @desc    Lấy danh sách hành khách của chuyến đi (cho tài xế)
// @route   GET /api/bookings/trip/:tripId/passengers
// @access  Private (chỉ tài xế và admin)
exports.getTripPassengers = async (req, res) => {
    try {
        const { tripId } = req.params;

        // 1. Kiểm tra quyền
        if (req.user.vaiTro !== 'admin' && req.user.vaiTro !== 'tai_xe' && req.user.vaiTro !== 'driver') {
            return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
        }

        // 2. Lấy danh sách booking của chuyến đi
        const bookings = await Booking.find({ tripId })
            .populate('userId', 'hoTen soDienThoai')
            .populate('tripId', 'diemDi diemDen thoiGianKhoiHanh taiXe bienSoXe')
            .sort({ createdAt: 1 });

        // 3. Tính toán thống kê
        const totalPassengers = bookings.reduce((sum, booking) => sum + booking.danhSachGhe.length, 0);
        const checkedInPassengers = bookings.filter(b => b.trangThaiCheckIn === 'da_check_in')
            .reduce((sum, booking) => sum + booking.danhSachGhe.length, 0);

        res.status(200).json({
            success: true,
            data: {
                bookings,
                statistics: {
                    totalBookings: bookings.length,
                    totalPassengers,
                    checkedInPassengers,
                    pendingPassengers: totalPassengers - checkedInPassengers
                }
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
}

// @desc    Lấy thông tin vé theo mã (để hiển thị tên khách, ghế, trạng thái thanh toán)
// @route   GET /api/bookings/by-code/:code
// @access  Private (driver/admin)
exports.getBookingByCode = async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) return res.status(400).json({ success: false, message: 'Thiếu mã vé' });

    const booking = await Booking.findOne({ maVe: code })
      .populate('userId', 'hoTen soDienThoai')
      .populate('tripId', 'diemDi diemDen thoiGianKhoiHanh');
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy vé' });

    // Role check (driver/admin)
    const isAdmin = req.user?.vaiTro === 'admin';
    const isDriver = req.user?.vaiTro === 'tai_xe' || req.user?.vaiTro === 'driver';
    if (!(isAdmin || isDriver || String(booking.userId._id) === String(req.user._id))) {
      return res.status(403).json({ success: false, message: 'Không có quyền xem vé này' });
    }

    return res.json({
      success: true,
      data: {
        _id: booking._id,
        code: booking.maVe,
        user: booking.userId ? { _id: booking.userId._id, hoTen: booking.userId.hoTen, soDienThoai: booking.userId.soDienThoai } : null,
        danhSachGhe: booking.danhSachGhe,
        trangThaiThanhToan: booking.trangThaiThanhToan,
        paymentMethod: booking.paymentMethod,
        tongTien: booking.tongTien,
        trip: booking.tripId,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};

// @desc    Xác nhận thanh toán tiền mặt theo mã vé (dành cho tài xế/admin)
// @route   POST /api/bookings/cash-confirm
// @access  Private (driver/admin)
exports.cashConfirmBooking = async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ success: false, message: 'Thiếu mã vé' });

    const isAdmin = req.user?.vaiTro === 'admin';
    const isDriver = req.user?.vaiTro === 'tai_xe' || req.user?.vaiTro === 'driver';
    if (!(isAdmin || isDriver)) {
      return res.status(403).json({ success: false, message: 'Chỉ tài xế hoặc admin mới được xác nhận tiền mặt' });
    }

    const booking = await Booking.findOne({ maVe: code });
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy vé' });

    booking.trangThaiThanhToan = 'da_thanh_toan';
    booking.paymentMethod = 'cash';
    booking.paidAt = new Date();
    await booking.save();

    return res.json({ success: true, message: 'Đã xác nhận thanh toán tiền mặt', data: booking });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};