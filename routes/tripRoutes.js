// File: routes/tripRoutes.js

const express = require('express');
const router = express.Router();
const { createTrip, findTrips, getTripById } = require('../controllers/tripController');
const { protect, isAdmin } = require('../middleware/authMiddleware'); // <-- THÊM 'isAdmin' VÀO ĐÂY

// Định nghĩa các routes
router.route('/')
  // Gắn cả hai middleware vào. Yêu cầu sẽ đi qua 'protect' trước, rồi mới đến 'isAdmin'.
  .post(protect, isAdmin, createTrip) // <-- SỬA LẠI DÒNG NÀY
  .get(findTrips);

router.route('/:id')
  .get(getTripById);

module.exports = router;