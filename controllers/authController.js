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
        _id: user._id,
        hoTen: user.hoTen,
        soDienThoai: user.soDienThoai,
        vaiTro: user.vaiTro || 'user', // Đảm bảo có giá trị mặc định
        token: generateToken(user._id)
      };

      console.log('Login response:', response); // Debug log
      res.json(response);
    } else {
      res.status(401).json({ message: 'Số điện thoại hoặc mật khẩu không chính xác' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// Endpoint để lấy thông tin user hiện tại
exports.getMe = async (req, res) => {
  try {
    // req.user đã được set bởi middleware protect
    const user = await User.findById(req.user._id);
    res.json({
      _id: user._id,
      hoTen: user.hoTen,
      soDienThoai: user.soDienThoai,
      vaiTro: user.vaiTro,
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};