// File: routes/tripRoutes.js

const express = require('express');
const router = express.Router();
const { 
  createTrip, 
  findTrips, 
  getTripById, 
  updateTrip, 
  deleteTrip, 
  getTripsByDriver, 
  getLateTrips,
  getTripSummary
} = require('../controllers/tripController');
const { protect, isAdmin } = require('../middleware/authMiddleware');

// Định nghĩa các routes
router.route('/')
  .post(protect, isAdmin, createTrip) 
  .get(findTrips);

// Place specific routes BEFORE param routes to avoid conflicts
router.get('/late', protect, getLateTrips);
router.get('/driver/:id/upcoming', getTripsByDriver);
router.get('/:id/summary', protect, getTripSummary);

router.route('/:id')
  .get(getTripById)
  .put(protect, isAdmin, updateTrip)
  .delete(protect, isAdmin, deleteTrip);

module.exports = router;