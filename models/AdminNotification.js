const mongoose = require('mongoose');

const AdminNotificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Object, default: {} },
    createdBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String },
      role: { type: String, default: 'admin' },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdminNotification', AdminNotificationSchema);


