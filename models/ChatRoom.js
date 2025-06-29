// File: models/ChatRoom.js
const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  participants: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  }],
  participantNames: [{ 
    type: String 
  }],
  participantRoles: [{ 
    type: String 
  }],
  tripId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Trip' 
  },
  tripRoute: { 
    type: String 
  },
  lastMessage: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'ChatMessage' 
  },
  unreadCount: { 
    type: Number, 
    default: 0 
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
chatRoomSchema.index({ participants: 1 });
chatRoomSchema.index({ tripId: 1 });
chatRoomSchema.index({ updatedAt: -1 });

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

module.exports = ChatRoom;
