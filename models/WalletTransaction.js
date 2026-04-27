const mongoose = require('mongoose');

const walletTxSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['topup', 'payment', 'refund', 'withdrawal', 'salary'], required: true },
  amount: { type: Number, required: true },
  ref: { type: String },
}, { timestamps: true });

// Index for fast lookup by user
walletTxSchema.index({ userId: 1, createdAt: -1 });

// Avoid double processing by enforcing uniqueness for (type, ref) when ref exists
walletTxSchema.index(
  { type: 1, ref: 1 },
  { unique: true, partialFilterExpression: { ref: { $exists: true, $ne: '' } } }
);

module.exports = mongoose.model('WalletTransaction', walletTxSchema);


