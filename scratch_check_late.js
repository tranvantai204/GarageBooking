const mongoose = require('mongoose');
const Trip = require('./models/Trip');
require('dotenv').config();

async function check() {
  await mongoose.connect('mongodb+srv://tai123:tai123@cluster0.p78vi.mongodb.net/GarageBooking?retryWrites=true&w=majority');
  const now = new Date();
  console.log('Now:', now.toISOString());
  
  const lateTrips = await Trip.find({
    $or: [
      { trangThai: 'chua_khoi_hanh', thoiGianKhoiHanh: { $lt: now } },
      { trangThai: 'da_huy_do_tre' }
    ]
  });
  
  console.log('Late trips found:', lateTrips.length);
  lateTrips.forEach(t => {
    console.log(`- ${t.diemDi} -> ${t.diemDen} at ${t.thoiGianKhoiHanh.toISOString()}, Status: ${t.trangThai}`);
  });
  
  process.exit(0);
}

check();
