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
const feedbackRoutes = require('./routes/feedbackRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const refundRoutes = require('./routes/refundRoutes');
const walletRoutes = require('./routes/walletRoutes');

const app = express();

// Body parsers (support JSON and x-www-form-urlencoded from payment providers)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/feedbacks', feedbackRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/wallet', walletRoutes);

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
const PushToken = require('./models/PushToken');
const admin = require('./init_fcm');

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
  socket.on('start_call', async (data) => {
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

      // Always send FCM push for incoming call so callee can see when app is background/terminated
      try {
        const tokenDoc = await PushToken.findOne({ userId: targetUserId });
        const targetFcmToken = tokenDoc?.token;
        if (targetFcmToken) {
          const message = {
            token: targetFcmToken,
            data: {
              type: 'incoming_call',
              channelName: String(channelName),
              callerName: String(caller?.userName || 'Người gọi'),
              callerUserId: String(caller?.userId || ''),
              callerRole: String(caller?.role || caller?.userRole || caller?.vaiTro || 'user'),
              callerAvatarUrl: String(caller?.avatarUrl || ''),
            },
            android: {
              priority: 'high',
              notification: { channelId: 'incoming_call', priority: 'max' },
            },
          };
          await admin.messaging().send(message);
          console.log(`🔔 Sent FCM incoming_call to user ${targetUserId}`);
        } else {
          // Fallback to user topic (works even if user hasn't re-logged)
          const topicMessage = {
            topic: `user_${String(targetUserId)}`,
            data: {
              type: 'incoming_call',
              channelName: String(channelName),
              callerName: String(caller?.userName || 'Người gọi'),
              callerUserId: String(caller?.userId || ''),
              callerRole: String(caller?.role || caller?.userRole || caller?.vaiTro || 'user'),
              callerAvatarUrl: String(caller?.avatarUrl || ''),
            },
            android: {
              priority: 'high',
              notification: { channelId: 'incoming_call', priority: 'max' },
            },
          };
          await admin.messaging().send(topicMessage);
          console.log(`🔔 Sent FCM (topic) incoming_call to user ${targetUserId}`);
        }
      } catch (pushErr) {
        console.error('FCM push error:', pushErr);
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

      // Send FCM push to other participants (for background/terminated apps)
      try {
        const recipientIds = chat.participants
          .map((p) => String(p.userId))
          .filter((id) => id !== String(userId));
        if (recipientIds.length > 0) {
          const tokens = await PushToken.find({ userId: { $in: recipientIds } });
          const tokenList = tokens.map((t) => t.token).filter(Boolean);
          if (tokenList.length > 0) {
            const preview = (content || '').toString().slice(0, 120);
            const multicast = {
              notification: {
                title: `Tin nhắn mới từ ${user.hoTen}`,
                body: preview,
              },
              data: {
                type: 'chat_message',
                chatId: String(chatId),
                senderId: String(userId),
                senderName: String(user.hoTen || ''),
              },
              android: {
                priority: 'high',
                notification: { channelId: 'general_notifications', priority: 'high' },
              },
              tokens: tokenList,
            };
            await admin.messaging().sendEachForMulticast(multicast);
          }
        }
      } catch (pushErr) {
        console.error('FCM chat push error:', pushErr);
      }
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Handle typing indicators
  socket.on('typing', (data) => {
    const { chatId, isTyping } = data || {};
    if (!chatId) return;
    io.to(chatId).emit(isTyping ? 'typing_start' : 'typing_stop', {
      chatId,
      userId: socket.userId,
    });
  });

  // Handle disconnect (single handler)
  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      io.emit('user_status_update', { userId: socket.userId, isOnline: false, lastActiveAt: new Date().toISOString() });
      console.log(`👤 User ${socket.userId} disconnected`);
    }
    console.log('🔌 User disconnected:', socket.id);
  });

  // ===== Driver live location =====
  socket.on('driver_location', (data) => {
    try {
      // data: { userId, lat, lng, tripId }
      const { userId, lat, lng, tripId } = data || {};
      if (!userId || typeof lat !== 'number' || typeof lng !== 'number') return;
      // Broadcast to admins only for now
      io.emit('driver_location_update', { userId, lat, lng, tripId, ts: Date.now() });
    } catch (err) {
      console.error('driver_location error:', err);
    }
  });

  // ===== Trip lifecycle events =====
  socket.on('trip_started', async (data) => {
    try {
      const { tripId, driverId } = data || {};
      io.emit('trip_status_update', { tripId, driverId, status: 'started', ts: Date.now() });
      // Push a notification to all admins
      try {
        const admins = await User.find({ vaiTro: 'admin' }).select('_id');
        const adminIds = admins.map((u) => String(u._id));
        if (adminIds.length > 0) {
          const tokens = await PushToken.find({ userId: { $in: adminIds } });
          const tokenList = tokens.map((t) => t.token).filter(Boolean);
          if (tokenList.length > 0) {
            await admin.messaging().sendEachForMulticast({
              tokens: tokenList,
              notification: {
                title: 'Chuyến xe đang di chuyển',
                body: `Tài xế ${driverId || ''} đã bắt đầu chuyến ${tripId || ''}`,
              },
              data: { type: 'trip_started', tripId: String(tripId || ''), driverId: String(driverId || '') },
              android: {
                priority: 'high',
                notification: { channelId: 'general_notifications', priority: 'high' },
              },
            });
          }
        }
      } catch (pushErr) {
        console.error('trip_started push error:', pushErr);
      }
    } catch (e) {
      console.error('trip_started error', e);
    }
  });

  socket.on('trip_paused', async (data) => {
    try {
      const { tripId, driverId, paused } = data || {};
      io.emit('trip_status_update', { tripId, driverId, status: paused ? 'paused' : 'resumed', ts: Date.now() });
    } catch (e) {
      console.error('trip_paused error', e);
    }
  });

  socket.on('trip_ended', async (data) => {
    try {
      const { tripId, driverId } = data || {};
      io.emit('trip_status_update', { tripId, driverId, status: 'ended', ts: Date.now() });
      // Gửi FCM tới khách đã check-in để mời đánh giá
      try {
        const Booking = require('./models/Booking');
        const bookings = await Booking.find({ tripId, trangThaiCheckIn: 'da_check_in' }).select('userId');
        const userIds = bookings.map((b) => String(b.userId));
        if (userIds.length > 0) {
          const tokens = await PushToken.find({ userId: { $in: userIds } });
          const tokenList = tokens.map((t) => t.token).filter(Boolean);
          if (tokenList.length > 0) {
            await admin.messaging().sendEachForMulticast({
              tokens: tokenList,
              notification: {
                title: 'Đánh giá chuyến đi',
                body: 'Chuyến đã kết thúc, vui lòng đánh giá tài xế.',
              },
              data: {
                type: 'driver_rate_request',
                tripId: String(tripId || ''),
              },
              android: {
                priority: 'high',
                notification: { channelId: 'general_notifications', priority: 'high' },
              },
            });
          }
        }
      } catch (pushErr) { console.error('rate_request push error:', pushErr); }
    } catch (e) {
      console.error('trip_ended error', e);
    }
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
        // Also send FCM to ensure callee sees cancel when app is background
        (async () => {
          try {
            const tokenDoc = await PushToken.findOne({ userId: targetUserId });
            const token = tokenDoc?.token;
            if (token) {
              await admin.messaging().send({
                token,
                data: { type: 'call_cancelled', channelName: String(channelName || '') },
                android: { priority: 'high', notification: { channelId: 'incoming_call', priority: 'high' } },
              });
            } else {
              await admin.messaging().send({
                topic: `user_${String(targetUserId)}`,
                data: { type: 'call_cancelled', channelName: String(channelName || '') },
                android: { priority: 'high', notification: { channelId: 'incoming_call', priority: 'high' } },
              });
            }
          } catch (e) {}
        })();
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
      // Also push FCM so peer out-of-app exits popup
      (async () => {
        try {
          const tokenDoc = await PushToken.findOne({ userId: peerUserId });
          const token = tokenDoc?.token;
          if (token) {
            await admin.messaging().send({
              token,
              data: { type: 'call_ended', channelName: String(channelName || '') },
              android: { priority: 'high', notification: { channelId: 'incoming_call', priority: 'high' } },
            });
          } else {
            await admin.messaging().send({
              topic: `user_${String(peerUserId)}`,
              data: { type: 'call_ended', channelName: String(channelName || '') },
              android: { priority: 'high', notification: { channelId: 'incoming_call', priority: 'high' } },
            });
          }
        } catch (e) {}
      })();
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
