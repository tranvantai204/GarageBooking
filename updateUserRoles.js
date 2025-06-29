// Script để cập nhật vai trò user từ tai_xe thành driver
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const updateUserRoles = async () => {
    try {
        // Kết nối MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB đã kết nối');

        // Cập nhật tất cả user có role tai_xe thành driver
        const result = await User.updateMany(
            { vaiTro: 'tai_xe' },
            { $set: { vaiTro: 'driver' } }
        );

        console.log(`✅ Đã cập nhật ${result.modifiedCount} user từ tai_xe thành driver`);

        // Hiển thị danh sách users sau khi cập nhật
        const users = await User.find({}, 'hoTen soDienThoai vaiTro');
        console.log('\n📋 Danh sách users sau khi cập nhật:');
        users.forEach(user => {
            console.log(`👤 ${user.hoTen} (${user.soDienThoai}) - Role: ${user.vaiTro}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi:', error);
        process.exit(1);
    }
};

updateUserRoles();
