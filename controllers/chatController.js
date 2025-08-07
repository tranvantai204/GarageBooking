const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');

exports.getChats = async (req, res) => {
  try {
    const userId = req.user.id;

    const chats = await Chat.find({
      'participants.userId': userId,
      isActive: true
    })
    .sort({ updatedAt: -1 })
    .populate('participants.userId', 'hoTen vaiTro avatarUrl')
    .lean();

    // Format response
    const formattedChats = chats.map(chat => {
      const otherParticipant = chat.participants.find(p => p.userId._id.toString() !== userId);
      const unreadCount = chat.unreadCount?.get(userId) || 0;

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

    if (participantId === currentUserId) {
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
    let chat = await Chat.findOne({
      'participants.userId': { $all: [currentUserId, participantId] },
      isActive: true
    });

    if (!chat) {
      console.log('📝 Creating new chat...');
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
    } else {
      console.log('✅ Found existing chat with ID:', chat._id);
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
    const { content, messageType = 'text', replyTo } = req.body;
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