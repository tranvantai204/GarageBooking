const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { protect } = require('../middleware/authMiddleware');

// Cấu hình multer để lưu file vào bộ nhớ đệm (RAM) thay vì ổ cứng
const storage = multer.memoryStorage();

// File filter for images
const imageFilter = (req, file, cb) => {
  try {
    const allowedExt = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.heif'];
    const ext = path.extname(file.originalname || '').toLowerCase();
    const isImageMime = (file.mimetype || '').toLowerCase().startsWith('image/');
    const isAllowedExt = allowedExt.includes(ext);
    if (isImageMime || isAllowedExt) {
      return cb(null, true);
    }
    return cb(new Error('Chỉ chấp nhận file ảnh (jpg, png, gif, webp, bmp, heic/heif).'), false);
  } catch (e) {
    return cb(new Error('Lỗi kiểm tra định dạng ảnh'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // Giới hạn 10MB
  }
});

// ImgBB API Key
const IMGBB_API_KEY = '8bab664a9875c6df6e198f4763a20c22';

// Hàm helper để up ảnh lên ImgBB
const uploadToImgBB = async (fileBuffer, originalname) => {
  try {
    const base64Image = fileBuffer.toString('base64');
    
    // Sử dụng FormData
    const form = new FormData();
    form.append('key', IMGBB_API_KEY);
    form.append('image', base64Image);
    form.append('name', originalname.split('.')[0]); // Optional: tên file

    const response = await axios.post('https://api.imgbb.com/1/upload', form, {
      headers: {
        ...form.getHeaders()
      }
    });

    if (response.data && response.data.success) {
      return response.data.data.url; // Trả về link trực tiếp của ảnh
    }
    throw new Error('ImgBB API trả về lỗi');
  } catch (error) {
    console.error('ImgBB Upload Error:', error.response?.data || error.message);
    throw error;
  }
};

// @desc    Upload single image
// @route   POST /api/upload/image
// @access  Private
router.post('/image', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Không có file được upload' });
    }
    
    const imageUrl = await uploadToImgBB(req.file.buffer, req.file.originalname);
    
    return res.status(200).json({
      success: true,
      data: {
        imageUrl: imageUrl,
        filename: req.file.originalname,
        originalName: req.file.originalname,
        size: req.file.size
      },
      message: 'Upload ảnh thành công'
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi upload ảnh', error: error.message });
  }
});

// @desc    Upload multiple images
// @route   POST /api/upload/images
// @access  Private
router.post('/images', protect, upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có file được upload' });
    }
    
    const uploadedFiles = [];
    for (const file of req.files) {
      const url = await uploadToImgBB(file.buffer, file.originalname);
      uploadedFiles.push({
        imageUrl: url,
        filename: file.originalname,
        originalName: file.originalname,
        size: file.size
      });
    }
    
    return res.status(200).json({
      success: true,
      data: uploadedFiles,
      message: `Upload ${req.files.length} ảnh thành công`
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi upload ảnh', error: error.message });
  }
});

// @desc    Upload avatar and save to user profile
// @route   POST /api/upload/avatar
// @access  Private
const User = require('../models/User');
router.post('/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Không có file được upload' });
    }
    
    const avatarUrl = await uploadToImgBB(req.file.buffer, req.file.originalname);
    
    // Save avatarUrl to user in DB
    const user = await User.findByIdAndUpdate(
      req.user._id || req.user.id,
      { avatarUrl, updatedAt: new Date() },
      { new: true, select: '-matKhau' }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }
    
    console.log(`✅ Avatar updated for user ${user._id}: ${avatarUrl}`);
    
    return res.status(200).json({
      success: true,
      data: {
        avatarUrl: avatarUrl,
        filename: req.file.originalname,
        originalName: req.file.originalname,
        size: req.file.size
      },
      message: 'Cập nhật ảnh đại diện thành công'
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi upload ảnh đại diện', error: error.message });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'File quá lớn. Giới hạn 10MB' });
    }
  }
  return res.status(500).json({ success: false, message: error.message || 'Lỗi upload file' });
});

module.exports = router;
