const express = require('express');
const router = express.Router();
const { protect, isAdmin } = require('../middleware/authMiddleware');
const {
  getMyWallet,
  paySalary,
  requestWithdrawal,
  getWithdrawalRequests,
  processWithdrawal,
  fixBalance
} = require('../controllers/walletController');

// User & Driver routes
router.get('/me', protect, getMyWallet);
router.post('/withdraw', protect, requestWithdrawal);

// Admin only routes
router.post('/pay-salary', protect, isAdmin, paySalary);
router.get('/admin/withdrawals', protect, isAdmin, getWithdrawalRequests);
router.put('/admin/withdrawals/:id', protect, isAdmin, processWithdrawal);
router.post('/admin/fix-balance/:id', protect, isAdmin, fixBalance);


module.exports = router;
