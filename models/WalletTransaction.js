const mongoose = require('mongoose');

const walletTxSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['topup', 'payment', 'refund'], required: true },
  amount: { type: Number, required: true },
  ref: { type: String },
}, { timestamps: true });

// Avoid double processing by enforcing uniqueness for (type, ref) when ref exists
// This makes topup/payment idempotent across retries provided the provider sends the same txnId
walletTxSchema.index(
  { type: 1, ref: 1 },
  { unique: true, partialFilterExpression: { ref: { $exists: true, $ne: '' } } }
);

module.exports = mongoose.model('WalletTransaction', walletTxSchema);


