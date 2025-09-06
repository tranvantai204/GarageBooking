// File: routes/tripRoutes.js

const express = require('express');
const router = express.Router();
const { createTrip, findTrips, getTripById, updateTrip, deleteTrip, getTripsByDriver } = require('../controllers/tripController');
const { protect, isAdmin } = require('../middleware/authMiddleware');

// Định nghĩa các routes
router.route('/')
  // Gắn cả hai middleware vào. Yêu cầu sẽ đi qua 'protect' trước, rồi mới đến 'isAdmin'.
  .post(protect, isAdmin, createTrip) 
  .get(findTrips);

// Place specific routes BEFORE param routes to avoid conflicts
router.get('/driver/:id/upcoming', getTripsByDriver);

router.route('/:id')
  .get(getTripById)
  .put(protect, isAdmin, updateTrip)
  .delete(protect, isAdmin, deleteTrip);

module.exports = router;