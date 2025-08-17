// File: models/Trip.js

const mongoose = require('mongoose');

// Định nghĩa cấu trúc cho một chiếc ghế
const seatSchema = new mongoose.Schema({
  tenGhe: { type: String, required: true }, // Ví dụ: 'A1', 'A2', 'B1'...
  trangThai: {
    type: String,
    enum: ['trong', 'da_dat', 'dang_chon'], // Chỉ cho phép 3 trạng thái này
    default: 'trong',
  },
  giaVe: { type: Number, required: true }
}, { _id: false }); // _id: false để không tự tạo _id cho mỗi ghế

// Định nghĩa cấu trúc cho một Chuyến đi
const tripSchema = new mongoose.Schema({
  nhaXe: {
    type: String,
    required: true,
    default: "Hà Phương"
  },
  diemDi: {
    type: String,
    required: [true, 'Điểm đi là bắt buộc'],
  },
  diemDen: {
    type: String,
    required: [true, 'Điểm đến là bắt buộc'],
  },
  thoiGianKhoiHanh: {
    type: Date,
    required: [true, 'Thời gian khởi hành là bắt buộc'],
  },
  soGhe: {
    type: Number,
    required: true,
  },
  danhSachGhe: [seatSchema], // Một mảng các đối tượng ghế theo cấu trúc seatSchema
  taiXe: {
    type: String,
    default: "Chưa cập nhật"
  },
  taiXeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  bienSoXe: {
    type: String,
    default: "Chưa cập nhật"
  },
  loaiXe: {
    type: String,
    default: "ghe_ngoi"
  },
  vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle' },
  vehicleInfo: {
    tenXe: { type: String },
    hangXe: { type: String },
    bienSoXe: { type: String },
    hinhAnh: [{ type: String }]
  },
  trangThai: {
    type: String,
    enum: ['chua_khoi_hanh', 'dang_di', 'da_hoan_thanh', 'da_huy'],
    default: 'chua_khoi_hanh'
  }
}, {
  timestamps: true, // Tự động thêm createdAt, updatedAt
});

const Trip = mongoose.model('Trip', tripSchema);

module.exports = Trip;