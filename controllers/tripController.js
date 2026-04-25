// File: controllers/tripController.js

const Trip = require('../models/Trip');
const mongoose = require('mongoose');

// @desc    Admin tạo chuyến đi mới
// @route   POST /api/trips
// @access  Private/Admin
exports.createTrip = async (req, res) => {
  try {
    const {
      diemDi,
      diemDen,
      thoiGianKhoiHanh,
      soGhe,
      giaVe,
      taiXe,
      taiXeId,
      bienSoXe,
      loaiXe,
      vehicleId,
    } = req.body;

    // 1. Tạo danh sách ghế tự động
    const danhSachGhe = [];
    for (let i = 1; i <= soGhe; i++) {
      danhSachGhe.push({
        tenGhe: `A${i}`, // Tạm thời đặt tên ghế đơn giản, có thể nâng cấp sau
        trangThai: 'trong',
        giaVe: giaVe // Gán giá vé cho từng ghế
      });
    }

    // 2. Tạo chuyến đi mới trong database
    const tripData = {
      diemDi,
      diemDen,
      thoiGianKhoiHanh,
      soGhe,
      danhSachGhe, // Thêm danh sách ghế đã tạo
      taiXe: taiXe || "Chưa cập nhật",
      taiXeId: taiXeId || null,
      bienSoXe: bienSoXe || "Chưa cập nhật",
      loaiXe: loaiXe || "ghe_ngoi",
    };

    if (vehicleId) {
      try {
        const Vehicle = require('../models/Vehicle');
        const v = await Vehicle.findById(vehicleId);
        if (v) {
          tripData.vehicleId = v._id;
          tripData.vehicleInfo = {
            tenXe: v.tenXe,
            hangXe: v.hangXe,
            bienSoXe: v.bienSoXe,
            hinhAnh: Array.isArray(v.hinhAnh) ? v.hinhAnh : [],
          };
          // If not provided, derive fields from vehicle
          if (!tripData.bienSoXe || tripData.bienSoXe === 'Chưa cập nhật') {
            tripData.bienSoXe = v.bienSoXe;
          }
          if (!loaiXe) {
            tripData.loaiXe = v.loaiXe || 'ghe_ngoi';
          }
          if (!soGhe && v.soGhe) {
            tripData.soGhe = v.soGhe;
          }
        }
      } catch (e) {}
    }

    const trip = await Trip.create(tripData);

    res.status(201).json({ success: true, data: trip });

  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};

// @desc    Người dùng tìm kiếm các chuyến đi
// @route   GET /api/trips
// @access  Public
exports.findTrips = async (req, res) => {
  try {
    const { diemDi, diemDen, ngayDi } = req.query; // Lấy tham số từ URL, ví dụ: /api/trips?diemDi=Hà Nội&diemDen=Sapa

    console.log('🔍 Search params:', { diemDi, diemDen, ngayDi });

    // Nếu không có tham số tìm kiếm, trả về tất cả chuyến đi
    if (!diemDi && !diemDen && !ngayDi) {
      console.log('📋 Getting all trips...');
      const trips = await Trip.find({});
      console.log(`✅ Found ${trips.length} trips`);
      return res.status(200).json({ success: true, count: trips.length, data: trips });
    }

    // Nếu có tham số nhưng không đủ, yêu cầu đầy đủ
    if (!diemDi || !diemDen || !ngayDi) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đủ điểm đi, điểm đến và ngày đi.' });
    }

    // Xử lý ngày để tìm kiếm trong cả ngày đó
    const startOfDay = new Date(ngayDi);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(ngayDi);
    endOfDay.setHours(23, 59, 59, 999);

    const query = {
      diemDi: new RegExp(diemDi, 'i'), // 'i' để không phân biệt hoa thường
      diemDen: new RegExp(diemDen, 'i'),
      thoiGianKhoiHanh: {
        $gte: startOfDay, // Lớn hơn hoặc bằng đầu ngày
        $lte: endOfDay,   // Nhỏ hơn hoặc bằng cuối ngày
      }
    };

    console.log('🔍 Search query:', query);
    const trips = await Trip.find(query);
    console.log(`✅ Found ${trips.length} matching trips`);

    res.status(200).json({ success: true, count: trips.length, data: trips });
  } catch (error) {
    console.error('❌ Error in findTrips:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};

// @desc    Lấy các chuyến theo tài xế (upcoming)
// @route   GET /api/trips/driver/:id
// @access  Public
exports.getTripsByDriver = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'Missing driver id' });
    let driverObjectId;
    try { driverObjectId = new mongoose.Types.ObjectId(id); } catch (_) { driverObjectId = null; }
    const now = new Date();
    const query = {
      thoiGianKhoiHanh: { $gt: now },
      $or: [
        ...(driverObjectId ? [{ taiXeId: driverObjectId }] : []),
      ],
    };
    // If cannot parse ObjectId, still try by string compare in aggregation
    if (!driverObjectId) {
      query.$or.push({ taiXeId: id });
    }
    const trips = await Trip.find(query).sort({ thoiGianKhoiHanh: 1 });
    return res.json({ success: true, data: trips });
  } catch (error) {
    console.error('getTripsByDriver error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};


// @desc    Lấy thông tin chi tiết một chuyến đi
// @route   GET /api/trips/:id
// @access  Public
exports.getTripById = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi' });
    }

    res.status(200).json({ success: true, data: trip });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};

// @desc    Update trip information
// @route   PUT /api/trips/:id
// @access  Private/Admin
exports.updateTrip = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const trip = await Trip.findByIdAndUpdate(
      id,
      {
        ...updateData,
        updatedAt: new Date()
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chuyến đi'
      });
    }

    res.json({
      success: true,
      data: trip,
      message: 'Cập nhật chuyến đi thành công'
    });
  } catch (error) {
    console.error('Error updating trip:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi cập nhật chuyến đi',
      error: error.message
    });
  }
};

// @desc    Delete trip
// @route   DELETE /api/trips/:id
// @access  Private/Admin
exports.deleteTrip = async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy chuyến đi'
      });
    }

    // Check if there are any bookings for this trip
    const Booking = require('../models/Booking');
    const bookingCount = await Booking.countDocuments({ chuyenDi: req.params.id });

    if (bookingCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa chuyến đi này vì đã có ${bookingCount} vé được đặt`
      });
    }

    await Trip.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Đã xóa chuyến đi thành công'
    });
  } catch (error) {
    console.error('Delete trip error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

// @desc    Lấy danh sách các chuyến trễ hoặc bị hủy do trễ
// @route   GET /api/trips/late
// @access  Private
exports.getLateTrips = async (req, res) => {
  try {
    const now = new Date();
    const { driverId } = req.query;

    const baseQuery = {
      $or: [
        { trangThai: 'chua_khoi_hanh', thoiGianKhoiHanh: { $lt: now } },
        { trangThai: 'da_huy_do_tre' }
      ]
    };

    let filter = { ...baseQuery };

    if (driverId) {
      const User = require('../models/User');
      const user = await User.findById(driverId);
      
      const driverFilters = [];
      if (mongoose.Types.ObjectId.isValid(driverId)) {
        driverFilters.push({ taiXeId: driverId });
      } else {
        driverFilters.push({ taiXeId: driverId });
      }

      if (user && user.hoTen) {
        driverFilters.push({ taiXe: user.hoTen });
        // Also handle case-insensitive or partial matches if needed
        driverFilters.push({ taiXe: new RegExp(user.hoTen, 'i') });
      }

      filter = {
        ...baseQuery,
        $or: [
          ...baseQuery.$or,
          { $and: [ { $or: driverFilters } ] } // This logic is slightly wrong, let's fix it
        ]
      };
      
      // Correct logic: (status is late OR status is cancelled) AND (taiXeId is ID OR taiXe is Name)
      filter = {
        $and: [
          baseQuery,
          {
            $or: driverFilters
          }
        ]
      };
    }

    const trips = await Trip.find(filter).sort({ thoiGianKhoiHanh: -1 });

    res.json({
      success: true,
      count: trips.length,
      data: trips
    });
  } catch (error) {
    console.error('getLateTrips error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};

// @desc    Lấy tổng kết chuyến đi (doanh thu + đánh giá)
// @route   GET /api/trips/:id/summary
// @access  Private
exports.getTripSummary = async (req, res) => {
  try {
    const { id } = req.params;
    const trip = await Trip.findById(id);

    if (!trip) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến đi' });
    }

    const Booking = require('../models/Booking');
    const bookings = await Booking.find({ 
      tripId: id, 
      trangThaiThanhToan: 'da_thanh_toan' 
    }).populate('userId', 'hoTen soDienThoai');

    // Tính doanh thu
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.tongTien || 0), 0);

    // Lọc các đánh giá (nếu có lưu trong Booking)
    const feedbacks = bookings
      .filter(b => b.danhGia)
      .map(b => ({
        userName: b.userId?.hoTen || 'Khách hàng',
        rating: b.danhGia,
        comment: b.binhLuan,
        seats: b.danhSachGhe,
        time: b.updatedAt
      }));

    // Tính đánh giá trung bình
    const avgRating = feedbacks.length > 0 
      ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length 
      : 0;

    res.json({
      success: true,
      data: {
        tripId: trip._id,
        diemDi: trip.diemDi,
        diemDen: trip.diemDen,
        thoiGianKhoiHanh: trip.thoiGianKhoiHanh,
        trangThai: trip.trangThai,
        totalRevenue,
        avgRating: parseFloat(avgRating.toFixed(1)),
        feedbackCount: feedbacks.length,
        feedbacks
      }
    });
  } catch (error) {
    console.error('getTripSummary error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};