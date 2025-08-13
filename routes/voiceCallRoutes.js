const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { protect } = require('../middleware/authMiddleware');

// Agora configuration - using environment variables
const AGORA_APP_ID = process.env.AGORA_APP_ID || 'aec4d4a14d994fb1904ce07a17cd4c2c';
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '3d183599eb3a42938b2395362dcd2f7b';

// Simple token generation for development
// In production, use proper Agora token generation
router.post('/generate-token', protect, async (req, res) => {
  try {
    const { channelName, uid } = req.body;
    
    if (!channelName || uid === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Channel name and UID are required' 
      });
    }

    // For development/testing, return a simple token
    // In production, implement proper Agora token generation
    const token = `dev_token_${channelName}_${uid}_${Date.now()}`;
    
    res.json({
      success: true,
      token,
      channelName,
      uid,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    console.error('Error generating token:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate token' 
    });
  }
});

// Validate token
router.post('/validate-token', protect, async (req, res) => {
  try {
    const { token, channelName, uid } = req.body;
    
    // Basic validation
    const isValid = token && token.length > 0;
    
    res.json({
      success: true,
      valid: isValid,
      channelName,
      uid
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Token validation failed' 
    });
  }
});

module.exports = router;
