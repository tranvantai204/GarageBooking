// File: controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendOtpSms } = require('../utils/sms');
const { sendEmail } = require('../utils/email');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

exports.register = async (req, res) => {
  const { hoTen, soDienThoai, matKhau } = req.body;
  try {
    const userExists = await User.findOne({ soDienThoai });
    if (userExists) {
      return res.status(400).json({ message: 'Số điện thoại đã tồn tại' });
    }
    const user = await User.create({ hoTen, soDienThoai, matKhau });
    res.status(201).json({ _id: user._id, hoTen: user.hoTen, token: generateToken(user._id) });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

exports.login = async (req, res) => {
  const { soDienThoai, matKhau } = req.body;
  try {
    // Lấy user với cả matKhau và vaiTro
    const user = await User.findOne({ soDienThoai }).select('+matKhau +vaiTro');

    console.log('Found user:', user); // Debug log
    console.log('User vaiTro:', user?.vaiTro); // Debug log

    if (user && (await user.matchPassword(matKhau))) {
      const response = {
        _id: user._id,
        hoTen: user.hoTen,
        soDienThoai: user.soDienThoai,
        email: user.email,
        vaiTro: user.vaiTro || 'user',
        diaChi: user.diaChi,
        cccd: user.cccd,
        namSinh: user.namSinh,
        gplx: user.gplx,
        bienSoXe: user.bienSoXe,
        loaiXe: user.loaiXe,
        avatarUrl: user.avatarUrl,
        token: generateToken(user._id)
      };

      console.log('Login response:', response); // Debug log
      res.json(response);
    } else {
      res.status(401).json({
        message: 'Số điện thoại hoặc mật khẩu không chính xác'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// === Password reset via phone or email (OTP) ===
// @route POST /api/auth/forgot
exports.forgotPassword = async (req, res) => {
  try {
    const { soDienThoai, email } = req.body || {};
    if (!soDienThoai && !email) return res.status(400).json({ success: false, message: 'Thiếu số điện thoại hoặc email' });
    const user = await User.findOne(soDienThoai ? { soDienThoai } : { email });
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    // Rate-limit: chỉ cho gửi lại sau 60 giây
    const now = new Date();
    if (user.resetOtpLastSent && (now - user.resetOtpLastSent) < 60 * 1000) {
      const remain = 60 - Math.floor((now - user.resetOtpLastSent) / 1000);
      return res.status(429).json({ success: false, message: `Vui lòng thử lại sau ${remain}s` });
    }
    const otp = ('' + Math.floor(100000 + Math.random() * 900000));
    user.resetOtp = otp;
    user.resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 phút
    user.resetOtpLastSent = now;
    await user.save();
    // Nếu có email → gửi OTP qua email, ngược lại qua SMS
    if (email || user.email) {
      const target = email || user.email;
      await sendEmail(target, 'Ma OTP dat lai mat khau', `Ma OTP cua ban: ${otp} (hieu luc 10 phut)`);
      const includeOtp = !process.env.SMTP_HOST; // dev mode
      return res.json({ success: true, message: 'Đã gửi OTP qua email', ...(includeOtp ? { otp } : {}) });
    } else if (soDienThoai) {
      try { await sendOtpSms(soDienThoai, otp); } catch (_) {}
      const includeOtp = (process.env.SMS_PROVIDER || '').toLowerCase() !== 'twilio';
      return res.json({ success: true, message: 'Đã tạo OTP', ...(includeOtp ? { otp } : {}) });
    } else {
      return res.json({ success: true, message: 'Đã tạo OTP' });
    }
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Lỗi server', error: e.message });
  }
};

// @route POST /api/auth/reset
exports.resetPassword = async (req, res) => {
  try {
    const { soDienThoai, email, otp, matKhauMoi } = req.body || {};
    if ((!soDienThoai && !email) || !otp || !matKhauMoi) return res.status(400).json({ success: false, message: 'Thiếu dữ liệu' });
    const user = await User.findOne(soDienThoai ? { soDienThoai } : { email }).select('+matKhau');
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });
    if (!user.resetOtp || !user.resetOtpExpires || user.resetOtp !== otp || user.resetOtpExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP không hợp lệ hoặc đã hết hạn' });
    }
    user.matKhau = matKhauMoi;
    user.resetOtp = undefined;
    user.resetOtpExpires = undefined;
    await user.save();
    return res.json({ success: true, message: 'Đặt lại mật khẩu thành công' });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Lỗi server', error: e.message });
  }
};

// @desc    Get current user info
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-matKhau');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        hoTen: user.hoTen,
        soDienThoai: user.soDienThoai,
        email: user.email,
        vaiTro: user.vaiTro,
        diaChi: user.diaChi,
        cccd: user.cccd,
        namSinh: user.namSinh,
        gplx: user.gplx,
        bienSoXe: user.bienSoXe,
        loaiXe: user.loaiXe,
        avatarUrl: user.avatarUrl,
        isActive: user.isActive,
        viSoDu: user.viSoDu || 0,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

// @desc    Get all users
// @route   GET /api/auth/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
  try {
    // Get all users without isActive filter to debug
    const users = await User.find({}).select('-matKhau');
    console.log(`📊 Found ${users.length} users in database`);

    // Debug: Log all users with their IDs
    console.log('📋 All users in database:');
    users.forEach(user => {
      console.log(`  - ${user.hoTen} (ID: ${user._id}) [${user.vaiTro}]`);
      if (user._id.toString().length !== 24) {
        console.log(`    ⚠️ WARNING: Invalid ObjectId format!`);
      }
    });

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh sách users',
      error: error.message
    });
  }
};

// @desc    Create new user
// @route   POST /api/auth/users
// @access  Private/Admin
exports.createUser = async (req, res) => {
  try {
    const { hoTen, soDienThoai, email, matKhau, vaiTro, diaChi, cccd, namSinh, gplx, bienSoXe, loaiXe } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ soDienThoai });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Số điện thoại đã được sử dụng'
      });
    }

    // Create user
    const user = await User.create({
      hoTen,
      soDienThoai,
      email: email || '',
      matKhau: matKhau || '123456', // Default password
      vaiTro: vaiTro || 'user',
      diaChi: diaChi || '',
      cccd: cccd || '',
      namSinh: namSinh || '',
      gplx: gplx || '',
      bienSoXe: bienSoXe || '',
      loaiXe: loaiXe || '',
      isActive: true
    });

    console.log(`✅ Created user: ${user.hoTen} (${user.vaiTro})`);

    res.status(201).json({
      success: true,
      message: 'Tạo user thành công',
      data: {
        _id: user._id,
        hoTen: user.hoTen,
        soDienThoai: user.soDienThoai,
        email: user.email,
        vaiTro: user.vaiTro,
        diaChi: user.diaChi,
        cccd: user.cccd,
        namSinh: user.namSinh,
        gplx: user.gplx,
        bienSoXe: user.bienSoXe,
        loaiXe: user.loaiXe,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi tạo user',
      error: error.message
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/users/:id
// @access  Private
exports.updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated via this endpoint
    delete updateData.matKhau;
    delete updateData.vaiTro;
    delete updateData._id;

    const user = await User.findByIdAndUpdate(
      id,
      {
        ...updateData,
        updatedAt: new Date()
      },
      {
        new: true,
        runValidators: true,
        select: '-matKhau'
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy user'
      });
    }

    res.json({
      success: true,
      data: user,
      message: 'Cập nhật thông tin thành công'
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi cập nhật thông tin',
      error: error.message
    });
  }
};

// @desc    Get current user info
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-matKhau');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User không tồn tại'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy thông tin user',
      error: error.message
    });
  }
};

exports.getUserActivityStatus = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      online: user.online,
      lastActiveAt: user.lastActiveAt
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};