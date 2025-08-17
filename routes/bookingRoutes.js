// File: routes/bookingRoutes.js
const express = require('express');
const router = express.Router();
const { createBooking, getMyBookings, cancelBooking, checkInBooking, getTripPassengers, payBooking } = require('../controllers/bookingController');
const { protect } = require('../middleware/authMiddleware'); // Import "người gác cổng"

// Áp dụng middleware 'protect' cho tất cả các route bên dưới
// Bất kỳ ai muốn gọi các API này đều phải gửi token hợp lệ
router.route('/').post(protect, createBooking);
router.route('/mybookings').get(protect, getMyBookings);
router.route('/checkin').post(protect, checkInBooking);
router.route('/trip/:tripId/passengers').get(protect, getTripPassengers);
router.route('/:id').delete(protect, cancelBooking);
router.route('/:id/pay').post(protect, payBooking);

module.exports = router;