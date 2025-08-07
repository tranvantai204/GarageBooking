// File: models/Chat.js

const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['admin', 'user', 'driver'],
      required: true
    }
  }],
  lastMessage: {
    content: String,
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    senderName: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file'],
      default: 'text'
    }
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index để tìm kiếm nhanh
chatSchema.index({ 'participants.userId': 1 });
chatSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);
