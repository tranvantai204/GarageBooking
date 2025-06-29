// File: routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const { 
  getChatRooms, 
  getMessages, 
  sendMessage, 
  createOrGetChatRoom,
  markMessagesAsRead 
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

// Apply protect middleware to all routes
router.use(protect);

// Chat room routes
router.get('/rooms/:userId', getChatRooms);
router.post('/room', createOrGetChatRoom);

// Message routes
router.get('/messages/:roomId', getMessages);
router.post('/send', sendMessage);
router.put('/messages/:roomId/read', markMessagesAsRead);

module.exports = router;
