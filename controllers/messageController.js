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
  console.log('🔍 req.user:', req.user);
  // Tìm admin đầu tiên trong hệ thống
  const admin = await User.findOne({ role: 'admin' }).select('_id name');

  if (!admin) {
    return res.status(404).render('error', {
      title: 'Lỗi',
      msg: 'Không tìm thấy admin trong hệ thống'
    });
  }

  const messages = await Message.find({
    $or: [
      { sender: req.user._id, receiver: admin._id },
      { sender: admin._id, receiver: req.user._id }
    ]
  }).sort({ createdAt: 1 });

  const serializedMessages = messages.map(msg => ({
    sender: msg.sender.toString(),
    receiver: msg.receiver.toString(),
    senderName: msg.senderName,
    receiverName: msg.receiverName,
    content: msg.content,
    role: msg.role,
    createdAt: msg.createdAt
  }));

  res.status(200).render('chat', {
    title: 'Chat với admin',
    user: req.user,
    admin: {
      _id: admin._id.toString(),
      name: admin.name
    },
    messages: serializedMessages
  });
});

// API: Lấy lịch sử chat giữa admin và 1 user
exports.getChatHistory = catchAsync(async (req, res, next) => {
  const { userId } = req.params;

  const messages = await Message.find({
    $or: [
      { sender: req.user._id, receiver: userId },
      { sender: userId, receiver: req.user._id }
    ]
  }).sort({ createdAt: 1 });

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: { messages }
  });
});

// API: Lấy danh sách users có tin nhắn với admin
exports.getUsersWithMessages = catchAsync(async (req, res, next) => {
  const messages = await Message.find({
    $or: [{ sender: req.user._id }, { receiver: req.user._id }]
  })
    .populate('sender', 'name email')
    .populate('receiver', 'name email')
    .sort({ createdAt: -1 });

  // Lọc ra các user unique (không phải admin)
  const userMap = new Map();
  messages.forEach(msg => {
    const otherUser =
      msg.sender._id.toString() === req.user._id.toString()
        ? msg.receiver
        : msg.sender;

    if (otherUser.role !== 'admin' && !userMap.has(otherUser._id.toString())) {
      userMap.set(otherUser._id.toString(), {
        _id: otherUser._id,
        name: otherUser.name,
        email: otherUser.email,
        lastMessage: msg.content,
        lastMessageTime: msg.createdAt
      });
    }
  });

  res.status(200).json({
    status: 'success',
    results: userMap.size,
    data: { users: Array.from(userMap.values()) }
  });
});
