// File: index.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Route files
const authRoutes = require('./routes/authRoutes');
const tripRoutes = require('./routes/tripRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const chatRoutes = require('./routes/chatRoutes');
const voiceCallRoutes = require('./routes/voiceCallRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const voucherRoutes = require('./routes/voucherRoutes');
const adminRoutes = require('./routes/adminRoutes');
const systemRoutes = require('./routes/systemRoutes');
// const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors());

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/voice', voiceCallRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/system', systemRoutes);
// app.use('/api/upload', uploadRoutes);

// Serve static files (uploaded images)
app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
    res.send('API for Ha Phuong App is running...');
});

// Create HTTP server and Socket.IO
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {    origin: '*',
    methods: ['GET', 'POST'],
  },
  path: '/socket.io',
});

// Socket.IO connection handling
const Chat = require('./models/Chat');
const Message = require('./models/Message');
const User = require('./models/User');

// Store connected users
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // User joins with their ID (single handler)
  socket.on('join', async (userId) => {
    try {
      connectedUsers.set(userId, socket.id);
      socket.userId = userId;
      console.log(`👤 User ${userId} joined with socket ${socket.id}`);

      // Join user to their chat rooms
      const chats = await Chat.find({
        'participants.userId': userId,
        isActive: true
      });

      chats.forEach(chat => {
        socket.join(chat._id.toString());
        console.log(`📱 User ${userId} joined chat room ${chat._id}`);
      });

      // Broadcast online status
      io.emit('user_status_update', { userId, isOnline: true });
    } catch (error) {
      console.error('Join error:', error);
    }
  });

  // Defensive: re-map on start_call if caller provided (single handler)
  socket.on('start_call', (data) => {
    try {
      const { targetUserId, channelName, caller } = data || {};
      if (caller && caller.userId) {
        connectedUsers.set(caller.userId, socket.id);
      }
      if (!targetUserId || !channelName) return;
      const targetSocketId = connectedUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('incoming_call', { channelName, caller, targetUserId });
        console.log(`📞 Incoming call to ${targetUserId} on channel ${channelName}`);
      } else {
        console.log(`⚠️ Target user ${targetUserId} is not connected`);
      }
    } catch (err) {
      console.error('start_call error:', err);
    }
  });
  
    // Trạng thái tin nhắn: delivered, seen
    socket.on('message_delivered', (data) => {
      // data: { chatId, messageId, userId }
      io.to(data.chatId).emit('message_delivered', data);
    });
  
    socket.on('message_seen', (data) => {
      // data: { chatId, messageId, userId }
      io.to(data.chatId).emit('message_seen', data);
    });
  
    // Trạng thái đang soạn tin
    socket.on('typing_start', (data) => {
      io.to(data.chatId).emit('typing_start', { userId: socket.userId });
    });
    socket.on('typing_stop', (data) => {
      io.to(data.chatId).emit('typing_stop', { userId: socket.userId });
    });
  
    // (Removed duplicate join/disconnect handlers)

  // Handle sending messages
  socket.on('send_message', async (data) => {
    try {
      const { chatId, content, messageType = 'text', replyTo } = data;
      const userId = socket.userId;

      if (!userId || !chatId || !content) {
        socket.emit('error', { message: 'Missing required data' });
        return;
      }

      // Verify user is participant in this chat
      const chat = await Chat.findOne({
        _id: chatId,
        'participants.userId': userId,
        isActive: true
      });

      if (!chat) {
        socket.emit('error', { message: 'Chat not found' });
        return;
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

      // Emit message to all participants in the chat room
      io.to(chatId).emit('new_message', message);

      console.log(`💬 Message sent in chat ${chatId} by ${user.hoTen}`);
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    const { chatId, isTyping } = data;
    socket.to(chatId).emit('user_typing', {
      userId: socket.userId,
      isTyping
    });
  });

  // Handle disconnect (single handler)
  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      io.emit('user_status_update', { userId: socket.userId, isOnline: false });
      console.log(`👤 User ${socket.userId} disconnected`);
    }
    console.log('🔌 User disconnected:', socket.id);
  });

    // ===== Voice Call Signaling =====
    // (start_call handled above)

    // Caller cancels before connect
    socket.on('cancel_call', (data) => {
      try {
        const { targetUserId, channelName } = data || {};
        const targetSocketId = connectedUsers.get(targetUserId);
        if (targetSocketId) {
          io.to(targetSocketId).emit('call_cancelled', { channelName });
        }
      } catch (err) {
        console.error('cancel_call error:', err);
      }
    });

    // Callee accepts
    socket.on('accept_call', (data) => {
      try {
        const { callerUserId, channelName } = data || {};
        const callerSocketId = connectedUsers.get(callerUserId);
        if (callerSocketId) {
          io.to(callerSocketId).emit('call_accepted', { channelName });
        }
      } catch (err) {
        console.error('accept_call error:', err);
      }
    });

    // Callee declines
    socket.on('decline_call', (data) => {
      try {
        const { callerUserId, channelName } = data || {};
        const callerSocketId = connectedUsers.get(callerUserId);
        if (callerSocketId) {
          io.to(callerSocketId).emit('call_declined', { channelName });
        }
      } catch (err) {
        console.error('decline_call error:', err);
      }
    });

  // When either side ends the call, inform the peer to exit
  socket.on('end_call', (data) => {
    try {
      const { peerUserId, channelName } = data || {};
      const peerSocketId = connectedUsers.get(peerUserId);
      if (peerSocketId) {
        io.to(peerSocketId).emit('call_ended', { channelName });
      }
    } catch (err) {
      console.error('end_call error:', err);
    }
  });
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên cổng ${PORT}`);
  console.log(`💬 Socket.IO server ready`);
});
