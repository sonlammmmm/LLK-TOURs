const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.ObjectId, ref: 'User', required: true },
  receiver: { type: mongoose.Schema.ObjectId, ref: 'User', required: true },
  senderName: String,
  receiverName: String,
  role: { type: String, enum: ['user', 'admin'], required: true },
  content: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
