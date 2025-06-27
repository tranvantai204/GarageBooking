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
    const user = await User.findOne({ soDienThoai }).select('+matKhau');
    if (user && (await user.matchPassword(matKhau))) {
      res.json({ _id: user._id, hoTen: user.hoTen, token: generateToken(user._id) });
    } else {
      res.status(401).json({ message: 'Số điện thoại hoặc mật khẩu không chính xác' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};