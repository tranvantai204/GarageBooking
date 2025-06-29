// File: models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  hoTen: { type: String, required: true },
  soDienThoai: { type: String, required: true, unique: true },
  email: { type: String },
  matKhau: { type: String, required: true, select: false },
  vaiTro: { type: String, enum: ['user', 'admin', 'driver'], default: 'user' },
  diaChi: { type: String },

  // Driver specific fields
  cccd: { type: String }, // Số CCCD/CMND
  namSinh: { type: String }, // Năm sinh
  gplx: { type: String }, // Số bằng lái xe
  bienSoXe: { type: String }, // Biển số xe
  loaiXe: { type: String }, // Loại xe

  // Image URLs
  avatarUrl: { type: String },
  cccdImageUrl: { type: String },
  gplxImageUrl: { type: String },

  isActive: { type: Boolean, default: true },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('matKhau')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.matKhau = await bcrypt.hash(this.matKhau, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.matKhau);
};

const User = mongoose.model('User', userSchema);
module.exports = User;