const mongoose = require('mongoose');

const walletTxSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['topup', 'payment', 'refund'], required: true },
  amount: { type: Number, required: true },
  ref: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('WalletTransaction', walletTxSchema);


