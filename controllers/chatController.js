const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const mongoose = require('mongoose');

exports.getChats = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('🔍 Getting chat rooms for user:', userId);

    const chats = await Chat.find({
      'participants.userId': userId,
      isActive: true
    })
    .sort({ updatedAt: -1 })
    .populate('participants.userId', 'hoTen vaiTro avatarUrl')
    .lean();

    console.log(`📊 Found ${chats.length} chats for user ${userId}`);

    // Format response
    const formattedChats = chats.map(chat => {
      const otherParticipant = chat.participants.find(p => p.userId._id.toString() !== userId);

      // Handle both Map and Object formats for unreadCount
      let unreadCount = 0;
      if (chat.unreadCount) {
        if (typeof chat.unreadCount.get === 'function') {
          // It's a Map
          unreadCount = chat.unreadCount.get(userId) || 0;
        } else if (typeof chat.unreadCount === 'object') {
          // It's a plain object
          unreadCount = chat.unreadCount[userId] || 0;
        }
      }

      return {
        id: chat._id,
        participant: {
          id: otherParticipant?.userId._id,
          name: otherParticipant?.name || otherParticipant?.userId.hoTen,
          role: otherParticipant?.role || otherParticipant?.userId.vaiTro,
          avatar: otherParticipant?.userId.avatarUrl
        },
        lastMessage: chat.lastMessage,
        unreadCount,
        updatedAt: chat.updatedAt
      };
    });

    res.json({
      success: true,
      data: formattedChats
    });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

exports.createOrGetChat = async (req, res) => {
  try {
    console.log('🔄 Create chat request:', req.body);
    const { participantId } = req.body;
    const currentUserId = req.user.id;
    console.log('👤 Current user ID:', currentUserId);
    console.log('🎯 Target participant ID:', participantId);

    if (!participantId) {
      console.log('❌ Missing participant ID');
      return res.status(400).json({
        success: false,
        message: 'Participant ID is required'
      });
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(participantId)) {
      console.log('❌ Invalid participant ID format:', participantId);
      return res.status(400).json({
        success: false,
        message: 'Invalid participant ID format'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(currentUserId)) {
      console.log('❌ Invalid current user ID format:', currentUserId);
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }

    if (participantId.toString() === currentUserId.toString()) {
      console.log('❌ Cannot create chat with yourself');
      return res.status(400).json({
        success: false,
        message: 'Cannot create chat with yourself'
      });
    }

    // Get participant info
    console.log('🔍 Looking up users...');
    const participant = await User.findById(participantId).select('hoTen vaiTro avatarUrl');
    const currentUser = await User.findById(currentUserId).select('hoTen vaiTro avatarUrl');

    console.log('👤 Current user found:', currentUser ? currentUser.hoTen : 'null');
    console.log('🎯 Participant found:', participant ? participant.hoTen : 'null');

    if (!participant || !currentUser) {
      console.log('❌ User not found');
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if chat already exists
    console.log('🔍 Checking for existing chat...');
    console.log('🔍 Query: participants.userId $all [', currentUserId, ',', participantId, ']');

    // More specific query to ensure exactly 2 participants
    let chat = await Chat.findOne({
      $and: [
        { 'participants.userId': currentUserId },
        { 'participants.userId': participantId },
        { 'participants': { $size: 2 } }, // Exactly 2 participants
        { isActive: true }
      ]
    });

    console.log('🔍 Found existing chat:', chat ? chat._id : 'null');

    if (chat) {
      console.log('📋 Existing chat participants:', chat.participants.map(p => `${p.name} (${p.userId})`));
    }

    if (!chat) {
      console.log('📝 Creating new chat...');
      console.log('👥 Participants will be:');
      console.log('  - User 1:', currentUser.hoTen, '(', currentUserId, ')');
      console.log('  - User 2:', participant.hoTen, '(', participantId, ')');

      // Create new chat
      chat = new Chat({
        participants: [
          {
            userId: currentUserId,
            name: currentUser.hoTen,
            role: currentUser.vaiTro
          },
          {
            userId: participantId,
            name: participant.hoTen,
            role: participant.vaiTro
          }
        ],
        unreadCount: new Map([
          [currentUserId, 0],
          [participantId, 0]
        ])
      });

      await chat.save();
      console.log('✅ New chat created with ID:', chat._id);
      console.log('📋 New chat participants:', chat.participants.map(p => `${p.name} (${p.userId})`));
    } else {
      console.log('✅ Found existing chat with ID:', chat._id);
      console.log('📋 Existing chat participants:', chat.participants.map(p => `${p.name} (${p.userId})`));
    }

    // Validate data before sending response
    if (!chat || !chat._id) {
      console.log('❌ Chat object is invalid:', chat);
      return res.status(500).json({
        success: false,
        message: 'Failed to create/get chat'
      });
    }

    if (!participant || !participant._id) {
      console.log('❌ Participant object is invalid:', participant);
      return res.status(500).json({
        success: false,
        message: 'Participant not found'
      });
    }

    const responseData = {
      id: chat._id,
      participant: {
        id: participant._id,
        name: participant.hoTen,
        role: participant.vaiTro,
        avatar: participant.avatarUrl
      }
    };

    console.log('📤 Sending response:', responseData);
    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

exports.getTripGroupChat = async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user.id;

    if (!tripId) {
      return res.status(400).json({ success: false, message: 'Trip ID is required' });
    }

    // Find trip to get route info
    const Trip = require('../models/Trip');
    const trip = await Trip.findById(tripId);
    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found' });
    }

    // Check if trip group chat already exists
    let chat = await Chat.findOne({
      tripId: tripId,
      isGroup: true,
      isActive: true
    });

    if (!chat) {
      // Create new group chat for the trip
      // Initially, only the driver is a participant if exists, 
      // but users join when they open the chat
      const driver = await User.findById(trip.taiXeId);
      
      const participants = [];
      if (driver) {
        participants.push({
          userId: driver._id,
          name: driver.hoTen,
          role: 'driver'
        });
      }

      chat = new Chat({
        isGroup: true,
        tripId: tripId,
        participants: participants,
        unreadCount: new Map()
      });

      await chat.save();
    }

    // Add current user to participants if not already there
    const isParticipant = chat.participants.some(p => p.userId.toString() === userId);
    if (!isParticipant) {
      const user = await User.findById(userId);
      chat.participants.push({
        userId: user._id,
        name: user.hoTen,
        role: user.vaiTro
      });
      chat.unreadCount.set(userId, 0);
      await chat.save();
    }

    res.json({
      success: true,
      data: {
        id: chat._id,
        name: `Nhóm Chuyến: ${trip.diemDi} - ${trip.diemDen}`,
        tripId: chat.tripId,
        isGroup: true
      }
    });
  } catch (error) {
    console.error('Get trip group chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

// Debug API - List all chats
exports.getAllChats = async (req, res) => {
  try {
    const chats = await Chat.find({});

    console.log('📋 All chats in database:');
    chats.forEach(chat => {
      console.log(`  Chat ${chat._id}:`);
      chat.participants.forEach(p => {
        console.log(`    - ${p.name} (${p.userId}) [${p.role}]`);
      });
    });

    res.json({
      success: true,
      count: chats.length,
      data: chats.map(chat => ({
        id: chat._id,
        participants: chat.participants.map(p => ({
          userId: p.userId,
          name: p.name,
          role: p.role
        })),
        lastMessage: chat.lastMessage,
        createdAt: chat.createdAt
      }))
    });
  } catch (error) {
    console.error('Error getting all chats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.id;

    // Verify user is participant in this chat
    const chat = await Chat.findOne({
      _id: chatId,
      'participants.userId': userId,
      isActive: true
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    const messages = await Message.find({ chatId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('replyTo', 'content senderName')
      .lean();

    // Mark messages as read
    await Message.updateMany(
      {
        chatId,
        senderId: { $ne: userId },
        'readBy.userId': { $ne: userId }
      },
      {
        $push: {
          readBy: {
            userId,
            readAt: new Date()
          }
        }
      }
    );

    // Reset unread count for this user
    await Chat.updateOne(
      { _id: chatId },
      { $set: { [`unreadCount.${userId}`]: 0 } }
    );

    res.json({
      success: true,
      data: messages.reverse()
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, messageType = 'text', replyTo, fileUrl } = req.body;
    const userId = req.user.id;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Verify user is participant in this chat
    const chat = await Chat.findOne({
      _id: chatId,
      'participants.userId': userId,
      isActive: true
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    const user = await User.findById(userId).select('hoTen vaiTro');

    // Create message
    const message = new Message({
      chatId,
      senderId: userId,
      senderName: user.hoTen,
      senderRole: user.vaiTro,
      content: content.trim(),
      messageType,
      fileUrl: fileUrl,
      replyTo: replyTo || undefined,
      readBy: [{
        userId,
        readAt: new Date()
      }]
    });

    await message.save();

    // Update chat's last message and unread counts
    const updateData = {
      lastMessage: {
        content: content.trim(),
        senderId: userId,
        senderName: user.hoTen,
        timestamp: message.createdAt,
        messageType
      },
      updatedAt: new Date()
    };

    // Increment unread count for other participants
    chat.participants.forEach(participant => {
      if (participant.userId.toString() !== userId) {
        const currentCount = chat.unreadCount?.get(participant.userId.toString()) || 0;
        updateData[`unreadCount.${participant.userId}`] = currentCount + 1;
      }
    });

    await Chat.updateOne({ _id: chatId }, { $set: updateData });

    // Populate reply message if exists
    await message.populate('replyTo', 'content senderName');

    // Emit socket event and FCM push moved to socket layer for realtime; still return message
    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server',
      error: error.message
    });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log('🗑️ Delete message request:', { messageId: id, userId });
    
    const user = await User.findById(userId);
    const message = await Message.findById(id);
    
    if (!message) {
      console.log('❌ Message not found:', id);
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    console.log('📝 Message found:', { 
      messageId: message._id, 
      senderId: message.senderId, 
      content: message.content,
      chatId: message.chatId
    });
    
    // Only sender or admin can delete
    if (message.senderId.toString() !== userId && user.vaiTro !== 'admin') {
      console.log('❌ Permission denied:', { 
        messageSenderId: message.senderId, 
        currentUserId: userId, 
        userRole: user.vaiTro 
      });
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }
    
    const chatId = message.chatId;
    
    // Delete the message from database
    await Message.deleteOne({ _id: id });
    console.log('✅ Message deleted from database:', id);
    
    // Find the new last message for this chat
    const lastMessage = await Message.findOne({ chatId })
      .sort({ createdAt: -1 })
      .lean();
    
    console.log('🔍 Finding new last message for chat:', chatId);
    console.log('📝 New last message:', lastMessage ? lastMessage.content : 'No messages left');
    
    // Update chat's lastMessage
    const updateData = {
      updatedAt: new Date()
    };
    
    if (lastMessage) {
      // Update with new last message
      updateData.lastMessage = {
        content: lastMessage.content,
        senderId: lastMessage.senderId,
        senderName: lastMessage.senderName,
        timestamp: lastMessage.createdAt,
        messageType: lastMessage.messageType || 'text'
      };
      console.log('✅ Updated chat with new last message');
    } else {
      // No messages left, clear lastMessage
      updateData.lastMessage = null;
      console.log('✅ Cleared lastMessage (no messages left)');
    }
    
    await Chat.updateOne({ _id: chatId }, { $set: updateData });
    console.log('✅ Chat updated successfully');
    
    res.json({ 
      success: true, 
      message: 'Message deleted and chat updated',
      newLastMessage: updateData.lastMessage
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server', error: error.message });
  }
};