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
  nguoiCheckIn: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Tài xế check-in

  // Thông tin điểm đón
  loaiDiemDon: {
    type: String,
    enum: ['ben_xe', 'dia_chi_cu_the'],
    default: 'ben_xe'
  },
  diaChiDon: { type: String }, // Địa chỉ cụ thể nếu chọn 'dia_chi_cu_the'
  ghiChuDiemDon: { type: String } // Ghi chú thêm về điểm đón
}, {
  timestamps: true
});

// Optional voucher fields
bookingSchema.add({
  voucherCode: { type: String },
  discountAmount: { type: Number, default: 0 },
  thongTinKhachHang: {
    hoTen: { type: String },
    soDienThoai: { type: String },
    email: { type: String }
  }
});

// Snapshot vehicle info into ticket after purchase
bookingSchema.add({
  vehicleSnapshot: {
    tenXe: { type: String },
    hangXe: { type: String },
    bienSoXe: { type: String },
    hinhAnh: [{ type: String }]
  }
});

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;