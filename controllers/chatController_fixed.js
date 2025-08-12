// Fixed deleteMessage function
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