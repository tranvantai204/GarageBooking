// File: routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const {
  getChats,
  createOrGetChat,
  getMessages,
  sendMessage,
  getAllChats
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

// Apply protect middleware to all routes
router.use(protect);

// Chat routes
router.route('/')
  .get(getChats);

router.route('/create')
  .post(createOrGetChat);

// Debug route - list all chats
router.route('/debug/all')
  .get(getAllChats);

router.route('/:chatId/messages')
  .get(getMessages)
  .post(sendMessage);

module.exports = router;
