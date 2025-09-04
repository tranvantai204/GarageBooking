const mongoose = require('mongoose');

const paymentRequestSchema = new mongoose.Schema({
  orderCode: { type: Number, required: true, unique: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
}, { timestamps: true });

module.exports = mongoose.model('PaymentRequest', paymentRequestSchema);


