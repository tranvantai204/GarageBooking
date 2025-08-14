const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    bienSoXe: { type: String, required: true, unique: true },
    loaiXe: { type: String, enum: ['ghe_ngoi', 'giuong_nam', 'limousine'], default: 'ghe_ngoi' },
    soGhe: { type: Number, required: true },
    trangThai: { type: String, enum: ['hoat_dong', 'bao_tri', 'ngung'], default: 'hoat_dong' },
    ghiChu: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vehicle', vehicleSchema);


