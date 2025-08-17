const mongoose = require('mongoose');

const refundRequestSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  reason: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  method: { type: String, enum: ['wallet', 'bank'], default: 'wallet' },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('RefundRequest', refundRequestSchema);


