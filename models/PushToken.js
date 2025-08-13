const mongoose = require('mongoose');

const pushTokenSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true, unique: true },
    token: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PushToken', pushTokenSchema);


