// File: controllers/authController.js
const User = require('../models/User');
const jwt = require('jsonwebtoken');

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
        success: true,
        data: {
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
        }
      };

      console.log('Login response:', response); // Debug log
      res.json(response);
    } else {
      res.status(401).json({
        success: false,
        message: 'Số điện thoại hoặc mật khẩu không chính xác'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// @desc    Get all users
// @route   GET /api/auth/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).select('-matKhau');

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