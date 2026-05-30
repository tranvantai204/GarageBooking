// File: routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const {
  getChats,
  createOrGetChat,
  getMessages,
  sendMessage,
  getAllChats,
  deleteMessage,
  deleteChat,
  deleteTripGroupChat,
} = chatController;
const { protect } = require('../middleware/authMiddleware');

// Apply protect middleware to all routes
router.use(protect);

// Chat routes
router.route('/')
  .get(getChats);

router.route('/create')
  .post(createOrGetChat);

router.route('/trip/:tripId')
  .get(chatController.getTripGroupChat);

// Xóa group chat của chuyến đi (gọi khi hoàn thành chuyến)
router.delete('/trip/:tripId/group', deleteTripGroupChat);

// Debug route - list all chats
router.route('/debug/all')
  .get(getAllChats);

router.route('/:chatId/messages')
  .get(getMessages)
  .post(sendMessage);

// Xóa một tin nhắn
router.delete('/messages/:id', deleteMessage);

// Xóa cả đoạn chat
router.delete('/:chatId', deleteChat);

router.get('/user/:id/activity-status', require('../controllers/authController').getUserActivityStatus);
module.exports = router;