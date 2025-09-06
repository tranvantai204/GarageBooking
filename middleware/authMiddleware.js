// File: middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
  let token;

  // Kiểm tra xem header 'Authorization' có tồn tại và bắt đầu bằng 'Bearer' không
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Tách lấy token (Bỏ chữ 'Bearer ')
      token = req.headers.authorization.split(' ')[1];

      // Giải mã token để lấy id của user
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Tìm user trong DB bằng id đó, và gắn vào request để các hàm sau có thể dùng
      // -matKhau để không lấy trường mật khẩu
      req.user = await User.findById(decoded.id).select('-matKhau');

      return next(); // Cho phép đi tiếp đến hàm xử lý chính
    } catch (error) {
      console.error(error);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
};
exports.isAdmin = (req, res, next) => {
    // Hàm này phải được dùng SAU hàm 'protect', vì nó cần req.user do hàm 'protect' tạo ra
    if (req.user && req.user.vaiTro === 'admin') {
      return next(); // Nếu là admin, cho đi tiếp
    } else {
      return res.status(403).json({ success: false, message: 'Not authorized as an admin' }); // Lỗi 403 Forbidden: Bị cấm truy cập
    }
  };