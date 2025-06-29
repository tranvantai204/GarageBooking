// File: routes/authRoutes.js
const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  getAllUsers,
  updateUserProfile
} = require('../controllers/authController');
const { protect, isAdmin } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);

// User management routes
router.get('/users', protect, getAllUsers);
router.put('/users/:id', protect, updateUserProfile);

module.exports = router;