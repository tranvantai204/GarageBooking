// File: models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Trip', // Liên kết tới model Trip
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User', // Liên kết tới model User
  },
  danhSachGhe: [{ type: String, required: true }], // Mảng các tên ghế, ví dụ: ['A5', 'A6']
  tongTien: {
    type: Number,
    required: true,
  },
  maVe: { // Mã vé để cho nhà xe check
    type: String,
    required: true,
    unique: true
  },
  trangThaiThanhToan: {
    type: String,
    enum: ['chua_thanh_toan', 'da_thanh_toan'],
    default: 'chua_thanh_toan'
  },
  qrCode: { type: String }, // Mã QR cho vé
  trangThaiCheckIn: {
    type: String,
    enum: ['chua_check_in', 'da_check_in'],
    default: 'chua_check_in'
  },
  thoiGianCheckIn: { type: Date }, // Thời gian check-in
  nguoiCheckIn: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // Tài xế check-in
}, {
  timestamps: true
});

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;