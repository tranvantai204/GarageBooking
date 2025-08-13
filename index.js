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
// app.use('/api/upload', uploadRoutes);

// Serve static files (uploaded images)
app.use('/uploads', express.static('uploads'));

app.get('/', (req, res) => {
    res.send('API for Ha Phuong App is running...');
});

// Create HTTP server and Socket.IO
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.IO connection handling
const Chat = require('./models/Chat');
const Message = require('./models/Message');
const User = require('./models/User');

// Store connected users
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // User joins with their ID
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
    } catch (error) {
      console.error('Join error:', error);
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
  
    // Trạng thái online/offline
    socket.on('join', async (userId) => {
      // ...existing code...
      io.emit('user_status_update', { userId, isOnline: true });
    });
    socket.on('disconnect', () => {
      if (socket.userId) {
        io.emit('user_status_update', { userId: socket.userId, isOnline: false });
      }
      console.log('🔌 User disconnected:', socket.id);
    });

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

  // Handle disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      console.log(`👤 User ${socket.userId} disconnected`);
    }
    console.log('🔌 User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên cổng ${PORT}`);
  console.log(`💬 Socket.IO server ready`);
});
