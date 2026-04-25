const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Trip = require('../models/Trip');

dotenv.config();

const checkTrips = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/garage_booking');
    console.log('Connected to DB');

    const now = new Date();
    const trips = await Trip.find({
      trangThai: 'chua_khoi_hanh',
      thoiGianKhoiHanh: { $lt: now }
    });

    console.log(`Found ${trips.length} late trips in 'chua_khoi_hanh' state:`);
    trips.forEach(t => {
      console.log(`- ID: ${t._id}, Route: ${t.diemDi} -> ${t.diemDen}, Time: ${t.thoiGianKhoiHanh.toISOString()}, TaiXe: ${t.taiXe}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
};

checkTrips();
