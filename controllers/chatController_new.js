const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');

exports.getChats = async (req, res) => {
  try {
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

exports.createOrGetChat = async (req, res) => {
  try {
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

exports.getMessages = async (req, res) => {
  try {
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error' });
  }
};