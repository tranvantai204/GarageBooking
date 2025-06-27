// File: config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB đã kết nối: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Lỗi kết nối DB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;