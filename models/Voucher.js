const mongoose = require('mongoose');

const voucherSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    type: { type: String, enum: ['percent', 'amount'], required: true },
    value: { type: Number, required: true },
    minAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number },
    perUserLimit: { type: Number, default: 1 }, // 1: mỗi tài khoản 1 lần; >1: dùng nhiều lần
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    quota: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    onlyVip: { type: Boolean, default: false },
    routes: [{ type: String }],
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Voucher', voucherSchema);


