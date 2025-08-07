// Script để cập nhật vai trò user từ tai_xe thành driver
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const updateUserRoles = async () => {
    try {
        // Kết nối MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB đã kết nối');

        // Cập nhật user 0123456789 thành admin
        const adminResult = await User.updateOne(
            { soDienThoai: '0123456789' },
            { $set: { vaiTro: 'admin' } }
        );

        console.log(`✅ Đã cập nhật admin: ${adminResult.modifiedCount} user`);

        // Cập nhật tất cả user có role tai_xe thành driver
        const driverResult = await User.updateMany(
            { vaiTro: 'tai_xe' },
            { $set: { vaiTro: 'driver' } }
        );

        console.log(`✅ Đã cập nhật ${driverResult.modifiedCount} user từ tai_xe thành driver`);

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
