const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Feedback = require('../models/Feedback');

// Create feedback (user)
router.post('/', protect, async (req, res) => {
  try {
    const payload = {
      ...req.body,
      userId: req.user._id,
    };
    const fb = await Feedback.create(payload);
    res.status(201).json({ success: true, data: fb });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// List feedbacks (admin)
router.get('/', protect, async (req, res) => {
  if (req.user.vaiTro !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
  const list = await Feedback.find().sort({ createdAt: -1 });
  res.json({ success: true, data: list });
});

// Update status or edit (admin)
router.put('/:id', protect, async (req, res) => {
  if (req.user.vaiTro !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
  const fb = await Feedback.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data: fb });
});

// Delete (admin)
router.delete('/:id', protect, async (req, res) => {
  if (req.user.vaiTro !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });
  await Feedback.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;


