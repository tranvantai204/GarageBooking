const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    bienSoXe: { type: String, required: true, unique: true },
    loaiXe: { type: String, enum: ['ghe_ngoi', 'giuong_nam', 'limousine'], default: 'ghe_ngoi' },
    soGhe: { type: Number, required: true },
    trangThai: { type: String, enum: ['hoat_dong', 'bao_tri', 'ngung', 'ngung_hoat_dong'], default: 'hoat_dong' },
    tenXe: { type: String },
    hangXe: { type: String },
    hinhAnh: [{ type: String }], // URLs to images
    moTa: { type: String },
    ghiChu: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Vehicle', vehicleSchema);


