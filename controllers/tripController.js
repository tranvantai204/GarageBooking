// File: controllers/tripController.js

const Trip = require('../models/Trip');

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
      loaiXe
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
    const trip = await Trip.create({
      diemDi,
      diemDen,
      thoiGianKhoiHanh,
      soGhe,
      danhSachGhe, // Thêm danh sách ghế đã tạo
      taiXe: taiXe || "Chưa cập nhật",
      taiXeId: taiXeId || null,
      bienSoXe: bienSoXe || "Chưa cập nhật",
      loaiXe: loaiXe || "ghe_ngoi"
    });

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