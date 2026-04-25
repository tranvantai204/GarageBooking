// File: controllers/bookingController.js
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const QRCode = require('qrcode');
const User = require('../models/User');

// @desc    Tạo lượt đặt vé mới
// @route   POST /api/bookings
// @access  Private
exports.createBooking = async (req, res) => {
  const { tripId, danhSachGheDat, voucherCode, discountAmount, loaiDiemDon, diaChiDon, ghiChuDiemDon, thongTinKhachHang, forPhone } = req.body;

  try {
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi' });
    }

    // 1. Kiểm tra thời gian khởi hành (Chặn đặt vé dưới 1 tiếng)
    const now = new Date();
    const departureTime = new Date(trip.thoiGianKhoiHanh);
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    
    if (departureTime < oneHourFromNow) {
      return res.status(400).json({ 
        success: false, 
        message: 'Chuyến đi sắp khởi hành (trong vòng 1 tiếng), không thể đặt vé qua ứng dụng. Vui lòng liên hệ trực tiếp nhà xe.' 
      });
    }

    // 2. Kiểm tra Voucher (Xác thực lại trên Server)
    let appliedDiscount = 0;
    if (voucherCode) {
      const Voucher = require('../models/Voucher');
      const v = await Voucher.findOne({ code: voucherCode, active: true });
      if (!v) {
        return res.status(400).json({ success: false, message: 'Mã giảm giá không hợp lệ hoặc đã bị vô hiệu hóa' });
      }
      
      // Kiểm tra quota
      if (v.quota > 0 && v.used >= v.quota) {
        return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết lượt sử dụng' });
      }

      // Kiểm tra hạn dùng
      const start = new Date(v.startAt);
      const end = new Date(v.endAt);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      if (now < start || now > end) {
        return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết hạn sử dụng' });
      }

      // Tính toán lại discountAmount để đảm bảo tính chính xác
      // (Không tin tưởng hoàn toàn vào discountAmount từ client gửi lên)
      // Tạm thời tính toán cơ bản, logic đầy đủ sẽ nằm ở bước tính tổng tiền dưới đây
    }

    let tongTien = 0;
    const gheHopLe = [];

    trip.danhSachGhe.forEach(seat => {
      if (danhSachGheDat.includes(seat.tenGhe) && seat.trangThai === 'trong') {
        gheHopLe.push(seat);
        tongTien += seat.giaVe;
      }
    });

    if (gheHopLe.length !== danhSachGheDat.length) {
      return res.status(400).json({ success: false, message: 'Một hoặc nhiều ghế đã được đặt hoặc không hợp lệ. Vui lòng thử lại.' });
    }

    // Tính toán discountAmount thực tế
    if (voucherCode) {
      const Voucher = require('../models/Voucher');
      const v = await Voucher.findOne({ code: voucherCode });
      appliedDiscount = v.type === 'percent' ? (tongTien * v.value) / 100 : v.value;
      if (v.maxDiscount) appliedDiscount = Math.min(appliedDiscount, v.maxDiscount);
      
      // Tăng số lần sử dụng voucher
      v.used = (v.used || 0) + 1;
      await v.save();
    }

    gheHopLe.forEach(seat => {
      const seatInTrip = trip.danhSachGhe.find(s => s.tenGhe === seat.tenGhe);
      seatInTrip.trangThai = 'da_dat';
    });

    await trip.save();

    const maVe = `HAPHUONG-${Date.now()}`;

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
      tongTien: Math.max(0, tongTien - appliedDiscount),
      maVe: maVe,
      qrCode: qrCodeString,
      loaiDiemDon: loaiDiemDon || 'ben_xe',
      diaChiDon: diaChiDon,
      ghiChuDiemDon: ghiChuDiemDon,
    };
    if (voucherCode) bookingPayload.voucherCode = voucherCode;
    if (appliedDiscount > 0) bookingPayload.discountAmount = appliedDiscount;
    if (thongTinKhachHang && typeof thongTinKhachHang === 'object') {
      bookingPayload.thongTinKhachHang = thongTinKhachHang;
    }

    try {
      bookingPayload.vehicleSnapshot = {
        tenXe: trip.vehicleInfo?.tenXe,
        hangXe: trip.vehicleInfo?.hangXe,
        bienSoXe: trip.vehicleInfo?.bienSoXe || trip.bienSoXe,
        hinhAnh: Array.isArray(trip.vehicleInfo?.hinhAnh) ? trip.vehicleInfo.hinhAnh : [],
      };
    } catch (e) {}

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
exports.getMyBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ userId: req.user._id })
          .populate('tripId', 'diemDi diemDen thoiGianKhoiHanh taiXe bienSoXe loaiXe vehicleInfo trangThai')
          .sort({ createdAt: -1 });
        res.status(200).json({ success: true, count: bookings.length, data: bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
}

// @desc    Hủy vé
exports.cancelBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const booking = await Booking.findById(bookingId).populate('tripId');

        if (!booking) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy vé' });
        }

        if (booking.userId.toString() !== req.user._id.toString() && req.user.vaiTro !== 'admin') {
            return res.status(403).json({ success: false, message: 'Không có quyền hủy vé này' });
        }

        const now = new Date();
        const departureTime = new Date(booking.tripId.thoiGianKhoiHanh);
        const timeDiff = departureTime.getTime() - now.getTime();
        const hoursDiff = timeDiff / (1000 * 3600);

        if (now >= departureTime && req.user.vaiTro !== 'admin') {
            return res.status(400).json({ success: false, message: 'Chuyến đi đã bắt đầu, không thể hủy vé' });
        }

        if (hoursDiff < 1 && req.user.vaiTro !== 'admin') {
            return res.status(400).json({ success: false, message: 'Chỉ có thể hủy vé trước 1 giờ khởi hành' });
        }

        if (booking.trangThaiThanhToan === 'da_thanh_toan' && req.user.vaiTro !== 'admin') {
            return res.status(400).json({ success: false, message: 'Không thể hủy vé đã thanh toán. Vui lòng liên hệ nhà xe.' });
        }

        const trip = booking.tripId;
        booking.danhSachGhe.forEach(tenGhe => {
            const seat = trip.danhSachGhe.find(s => s.tenGhe === tenGhe);
            if (seat) seat.trangThai = 'trong';
        });

        await trip.save();
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
exports.checkInBooking = async (req, res) => {
    try {
        const { qrData } = req.body;
        let maVeStr = '';
        if (typeof qrData === 'string' && qrData.includes('|')) {
            const parts = qrData.split('|');
            if (parts.length >= 2) maVeStr = parts[1].trim();
        }

        if (!maVeStr) {
            let parsedData;
            try {
                parsedData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
                maVeStr = String(parsedData.maVe || '').trim();
            } catch (e) {
                if (typeof qrData === 'string' && qrData.trim()) {
                    maVeStr = qrData.trim();
                }
            }
        }

        if (!maVeStr) {
            const rawStr = typeof qrData === 'string' ? qrData : JSON.stringify(qrData);
            const normalized = String(rawStr || '').toUpperCase().replace(/\s+/g, '');
            let m = normalized.match(/HAPHUONG-?([0-9]{6,20})/);
            if (!m) {
                const m2 = normalized.match(/BOOKHAPHUONG-?([0-9]{6,20})/);
                if (m2) m = m2;
            }
            if (m) maVeStr = `HAPHUONG-${m[1]}`;
        }

        if (!maVeStr) return res.status(400).json({ success: false, message: 'Không tìm thấy mã vé trong QR' });

        let booking = await Booking.findOne({ maVe: maVeStr })
            .populate('tripId', 'diemDi diemDen thoiGianKhoiHanh taiXe')
            .populate('userId', 'hoTen soDienThoai');

        if (!booking && maVeStr.includes('HAPHUONG-')) {
            const alt = maVeStr.replace('HAPHUONG-', 'HAPHUONG');
            booking = await Booking.findOne({ maVe: alt })
                .populate('tripId', 'diemDi diemDen thoiGianKhoiHanh taiXe')
                .populate('userId', 'hoTen soDienThoai');
        }

        if (!booking) return res.status(404).json({ success: false, message: `Không tìm thấy vé: ${maVeStr}` });

        const role = String(req.user.vaiTro || req.user.role || '').toLowerCase();
        const isAdmin = role === 'admin';
        const isDriver = role === 'tai_xe' || role === 'driver';
        if (!(isAdmin || isDriver)) {
            return res.status(403).json({ success: false, message: 'Không có quyền check-in' });
        }

        if (booking.trangThaiCheckIn === 'da_check_in') {
            return res.status(400).json({
                success: false,
                message: 'Vé đã được check-in trước đó',
                data: { thoiGianCheckIn: booking.thoiGianCheckIn, nguoiCheckIn: booking.nguoiCheckIn }
            });
        }

        booking.trangThaiCheckIn = 'da_check_in';
        booking.thoiGianCheckIn = new Date();
        booking.nguoiCheckIn = req.user._id;

        await booking.save();

        res.status(200).json({
            success: true,
            message: 'Check-in thành công',
            data: { booking, khachHang: booking.userId, chuyenDi: booking.tripId }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
    }
}

// @desc    Mark booking as paid
exports.payBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { method, reference } = req.body;
    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy vé' });

    const isOwner = booking.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.vaiTro === 'admin';

    if (method === 'cash') {
      return res.status(400).json({ success: false, message: 'Hệ thống hiện không còn hỗ trợ thanh toán tiền mặt' });
    } else if (method === 'wallet') {
      if (!(isOwner || isAdmin)) {
        return res.status(403).json({ success: false, message: 'Không có quyền thanh toán ví cho vé này' });
      }
      const user = await User.findById(booking.userId);
      if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
      const paid = parseInt(booking.tongTien, 10) || 0;
      if ((user.viSoDu || 0) < paid) {
        return res.status(400).json({ success: false, message: 'Số dư ví không đủ' });
      }
      user.viSoDu = (user.viSoDu || 0) - paid;
      await user.save();

      // Ghi nhận giao dịch ví
      try {
        const WalletTx = require('../models/WalletTransaction');
        await WalletTx.create({
          userId: user._id,
          type: 'payment',
          amount: paid,
          ref: `WALLET-PAY-${booking.maVe}`,
          description: `Thanh toán vé ${booking.maVe}`
        });
      } catch (e) { console.error('WalletTx error:', e); }

      // Gửi thông báo
      try {
        const PushToken = require('../models/PushToken');
        const admin = require('../init_fcm');
        const tokenDoc = await PushToken.findOne({ userId: user._id });
        if (tokenDoc?.token) {
          await admin.messaging().send({
            token: tokenDoc.token,
            notification: { 
              title: 'Thanh toán thành công', 
              body: `Đã thanh toán ${paid.toLocaleString('vi-VN')}đ cho vé ${booking.maVe} bằng số dư ví` 
            },
            data: { type: 'booking_paid', bookingId: String(booking._id), maVe: booking.maVe },
            android: { priority: 'high', notification: { channelId: 'general_notifications', priority: 'high' } }
          });
        }
      } catch (e) { console.error('Push error:', e); }
    } else {
      if (!(isOwner || isAdmin)) {
        return res.status(403).json({ success: false, message: 'Không có quyền thanh toán vé này' });
      }
    }
    booking.trangThaiThanhToan = 'da_thanh_toan';
    booking.paymentMethod = method;
    booking.paymentRef = reference || undefined;
    booking.paidAt = new Date();
    await booking.save();
    res.json({ success: true, message: 'Thanh toán thành công', balance: method === 'wallet' ? (await User.findById(booking.userId)).viSoDu : undefined, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
}

// @desc    Lấy danh sách hành khách của chuyến đi (cho tài xế)
exports.getTripPassengers = async (req, res) => {
    try {
        const { tripId } = req.params;
        if (req.user.vaiTro !== 'admin' && req.user.vaiTro !== 'tai_xe' && req.user.vaiTro !== 'driver') {
            return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
        }

        const bookings = await Booking.find({ 
            tripId, 
            trangThaiThanhToan: 'da_thanh_toan' 
        })
            .populate('userId', 'hoTen soDienThoai')
            .populate('tripId', 'diemDi diemDen thoiGianKhoiHanh taiXe bienSoXe danhSachGhe actualEndTime endLocation isEarlyEnd distanceToDestAtEnd')
            .sort({ createdAt: 1 });

        const totalPassengers = bookings.reduce((sum, booking) => sum + booking.danhSachGhe.length, 0);
        const checkedInPassengers = bookings.filter(b => b.trangThaiCheckIn === 'da_check_in')
            .reduce((sum, booking) => sum + booking.danhSachGhe.length, 0);

        res.status(200).json({
            success: true,
            data: {
                trip: bookings.length > 0 ? bookings[0].tripId : await Trip.findById(tripId).select('diemDi diemDen thoiGianKhoiHanh taiXe bienSoXe danhSachGhe'),
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

// @desc    Lấy thông tin vé theo mã
exports.getBookingByCode = async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) return res.status(400).json({ success: false, message: 'Thiếu mã vé' });

    const booking = await Booking.findOne({ maVe: code })
      .populate('userId', 'hoTen soDienThoai')
      .populate('tripId', 'diemDi diemDen thoiGianKhoiHanh');
    if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy vé' });

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

// @desc    Gửi đánh giá và bình luận cho vé
// @route   POST /api/bookings/:id/feedback
// @access  Private
exports.submitFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { danhGia, binhLuan } = req.body;

    if (!danhGia || danhGia < 1 || danhGia > 5) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp số sao từ 1 đến 5' });
    }

    const booking = await Booking.findById(id).populate('tripId');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy vé' });
    }

    // Kiểm tra quyền (chủ sở hữu vé)
    if (booking.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Không có quyền đánh giá vé này' });
    }

    // Chỉ cho phép đánh giá khi chuyến đi đã hoàn thành
    if (booking.tripId.trangThai !== 'da_hoan_thanh') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể đánh giá sau khi chuyến đi kết thúc' });
    }

    booking.danhGia = danhGia;
    booking.binhLuan = binhLuan || '';
    await booking.save();

    res.json({ success: true, message: 'Cảm ơn bạn đã đánh giá!', data: booking });
  } catch (error) {
    console.error('submitFeedback error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};