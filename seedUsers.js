// File: seedUsers.js - Script to add sample users to MongoDB
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import User model
const User = require('./models/User');

const sampleUsers = [
  {
    hoTen: 'Admin Hà Phương',
    soDienThoai: '0123456789',
    email: 'admin@haphuong.com',
    matKhau: '123456',
    vaiTro: 'admin',
    diaChi: 'TP.HCM',
    isActive: true
  },
  {
    hoTen: 'Trần Văn Tài',
    soDienThoai: '0585761955',
    email: 'vtai14122004@gmail.com',
    matKhau: '123456',
    vaiTro: 'tai_xe',
    diaChi: 'Bình Thuận',
    cccd: '123456789012',
    namSinh: '1990',
    gplx: 'B2-123456',
    bienSoXe: '86-B4 12345',
    loaiXe: 'Xe khách 45 chỗ',
    isActive: true
  },
  {
    hoTen: 'Nguyễn Văn A',
    soDienThoai: '0987654321',
    email: 'user1@gmail.com',
    matKhau: '123456',
    vaiTro: 'user',
    diaChi: 'TP.HCM',
    isActive: true
  },
  {
    hoTen: 'Lê Thị B',
    soDienThoai: '0912345678',
    email: 'user2@gmail.com',
    matKhau: '123456',
    vaiTro: 'user',
    diaChi: 'Bình Thuận',
    isActive: true
  },
  {
    hoTen: 'Phạm Văn C',
    soDienThoai: '0934567890',
    email: 'driver2@haphuong.com',
    matKhau: '123456',
    vaiTro: 'tai_xe',
    diaChi: 'Đồng Nai',
    cccd: '987654321098',
    namSinh: '1985',
    gplx: 'B2-789012',
    bienSoXe: '60-A1 67890',
    loaiXe: 'Xe limousine 22 chỗ',
    isActive: true
  }
];

async function seedUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing users (optional)
    await User.deleteMany({});
    console.log('🗑️ Cleared existing users');

    // Hash passwords and create users
    for (let userData of sampleUsers) {
      const salt = await bcrypt.genSalt(10);
      userData.matKhau = await bcrypt.hash(userData.matKhau, salt);
      
      const user = new User(userData);
      await user.save();
      console.log(`👤 Created user: ${userData.hoTen} (${userData.vaiTro})`);
    }

    console.log('🎉 Successfully seeded users!');
    
    // Verify users were created
    const userCount = await User.countDocuments();
    console.log(`📊 Total users in database: ${userCount}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    process.exit(1);
  }
}

// Run the seed function
seedUsers();
