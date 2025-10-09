const Message = require('../models/messageModel');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');

// Trang admin chat
exports.getAdminChatView = catchAsync(async (req, res, next) => {
  const users = await User.find({ role: 'user' }).select('name email _id');
  res.status(200).render('adminChat', {
    title: 'Chat khách hàng',
    users
  });
});

// Trang user chat (/chat)
exports.getUserChatView = catchAsync(async (req, res, next) => {
  const messages = await Message.find({
    $or: [{ sender: req.user._id }, { receiver: req.user._id }]
  }).sort({ createdAt: 1 });
  res.status(200).render('chat', {
    title: 'Chat với admin',
    messages
  });
});
