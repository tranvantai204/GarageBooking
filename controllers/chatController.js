// File: controllers/chatController.js
const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');

// @desc    Get chat rooms for a user
// @route   GET /api/chat/rooms/:userId
// @access  Private
exports.getChatRooms = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const chatRooms = await ChatRoom.find({
      participants: userId,
      isActive: true
    })
    .populate('lastMessage')
    .populate('participants', 'hoTen vaiTro')
    .sort({ updatedAt: -1 });
    
    res.json({
      success: true,
      count: chatRooms.length,
      data: chatRooms
    });
  } catch (error) {
    console.error('Error getting chat rooms:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh sách chat',
      error: error.message
    });
  }
};

// @desc    Get messages for a chat room
// @route   GET /api/chat/messages/:roomId
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const messages = await ChatMessage.find({
      chatRoomId: roomId,
      isDeleted: false
    })
    .sort({ createdAt: 1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
    
    res.json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy tin nhắn',
      error: error.message
    });
  }
};

// @desc    Send a message
// @route   POST /api/chat/send
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { 
      chatRoomId, 
      senderId, 
      senderName, 
      senderRole, 
      message, 
      tripId 
    } = req.body;
    
    // Validate required fields
    if (!chatRoomId || !senderId || !senderName || !senderRole || !message) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin bắt buộc'
      });
    }
    
    // Create new message
    const newMessage = await ChatMessage.create({
      chatRoomId,
      senderId,
      senderName,
      senderRole,
      message,
      tripId
    });
    
    // Update chat room's last message
    await ChatRoom.findByIdAndUpdate(
      chatRoomId,
      { 
        lastMessage: newMessage._id,
        updatedAt: new Date()
      }
    );
    
    res.status(201).json({
      success: true,
      data: newMessage,
      message: 'Gửi tin nhắn thành công'
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi gửi tin nhắn',
      error: error.message
    });
  }
};

// @desc    Create or get existing chat room
// @route   POST /api/chat/room
// @access  Private
exports.createOrGetChatRoom = async (req, res) => {
  try {
    const { 
      participants, 
      participantNames, 
      participantRoles, 
      tripId, 
      tripRoute 
    } = req.body;
    
    // Validate required fields
    if (!participants || participants.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Cần ít nhất 2 người tham gia'
      });
    }
    
    // Check if room already exists between these participants
    let chatRoom = await ChatRoom.findOne({
      participants: { $all: participants, $size: participants.length },
      isActive: true
    });
    
    if (!chatRoom) {
      // Create new chat room
      const roomName = tripRoute || `Chat ${participantNames?.join(' - ') || 'Conversation'}`;
      
      chatRoom = await ChatRoom.create({
        name: roomName,
        participants,
        participantNames: participantNames || [],
        participantRoles: participantRoles || [],
        tripId,
        tripRoute
      });
    }
    
    res.json({
      success: true,
      data: chatRoom
    });
  } catch (error) {
    console.error('Error creating/getting chat room:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi tạo chat room',
      error: error.message
    });
  }
};

// @desc    Mark messages as read
// @route   PUT /api/chat/messages/:roomId/read
// @access  Private
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;
    
    await ChatMessage.updateMany(
      { 
        chatRoomId: roomId, 
        senderId: { $ne: userId },
        isRead: false 
      },
      { isRead: true }
    );
    
    res.json({
      success: true,
      message: 'Đánh dấu đã đọc thành công'
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi đánh dấu tin nhắn',
      error: error.message
    });
  }
};
