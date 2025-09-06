const mongoose = require('mongoose');

const driverApplicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    hoTen: { type: String, required: true },
    soDienThoai: { type: String, required: true },
    email: { type: String, default: '' },
    gplxUrl: { type: String }, // không bắt buộc nữa
    cccdUrl: { type: String }, // không bắt buộc nữa
    note: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DriverApplication', driverApplicationSchema);


