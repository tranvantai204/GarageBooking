// Script để thêm tài khoản tài xế
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const addDriverAccount = async () => {
    try {
        // Kết nối MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB đã kết nối');

        // Kiểm tra xem tài khoản tài xế đã tồn tại chưa
        const existingDriver = await User.findOne({ soDienThoai: '0111222333' });
        if (existingDriver) {
            console.log('Tài khoản tài xế đã tồn tại');
            process.exit(0);
        }

        // Tạo tài khoản tài xế
        const driver = await User.create({
            hoTen: 'Nguyễn Văn Tài',
            soDienThoai: '0111222333',
            matKhau: 'driver123',
            vaiTro: 'tai_xe'
        });

        console.log('Đã tạo tài khoản tài xế:', driver);
        console.log('Thông tin đăng nhập:');
        console.log('- Số điện thoại: 0111222333');
        console.log('- Mật khẩu: driver123');
        console.log('- Vai trò: tai_xe');

        process.exit(0);
    } catch (error) {
        console.error('Lỗi:', error);
        process.exit(1);
    }
};

addDriverAccount();
