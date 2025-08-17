const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const WalletTx = require('../models/WalletTransaction');
const User = require('../models/User');

// Get my wallet balance and last transactions
router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.user._id).select('viSoDu');
  const txs = await WalletTx.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, data: { balance: user?.viSoDu || 0, transactions: txs } });
});

module.exports = router;


