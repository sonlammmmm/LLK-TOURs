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

// API: Lấy danh sách users có tin nhắn với admin (với phân trang)
exports.getUsersWithMessages = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 8;
  const skip = (page - 1) * limit;

  const usersWithLastMessage = await Message.aggregate([
    {
      $match: {
        $or: [{ sender: req.user._id }, { receiver: req.user._id }]
      }
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: {
          $cond: [{ $eq: ['$sender', req.user._id] }, '$receiver', '$sender']
        },
        lastMessage: { $first: '$content' },
        lastMessageTime: { $first: '$createdAt' }
      }
    },
    { $sort: { lastMessageTime: -1 } },
    { $skip: skip },
    { $limit: limit }
  ]);

  const userIds = usersWithLastMessage.map(u => u._id);
  const users = await User.find({ _id: { $in: userIds }, role: 'user' }).select(
    'name email role'
  );

  const usersMap = new Map(users.map(u => [u._id.toString(), u]));
  const result = usersWithLastMessage
    .map(item => {
      const user = usersMap.get(item._id.toString());
      if (!user) return null;
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        lastMessage: item.lastMessage,
        lastMessageTime: item.lastMessageTime
      };
    })
    .filter(Boolean);

  const totalUsers = await Message.aggregate([
    {
      $match: {
        $or: [{ sender: req.user._id }, { receiver: req.user._id }]
      }
    },
    {
      $group: {
        _id: {
          $cond: [{ $eq: ['$sender', req.user._id] }, '$receiver', '$sender']
        }
      }
    },
    { $count: 'total' }
  ]);

  const total = totalUsers.length > 0 ? totalUsers[0].total : 0;
  const totalPages = Math.ceil(total / limit);
  const hasMore = page < totalPages;

  res.status(200).json({
    status: 'success',
    results: result.length,
    data: {
      users: result,
      pagination: { page, limit, total, totalPages, hasMore }
    }
  });
});

// ✅ API mới: Tìm kiếm user theo tên, email, hoặc ID (hỗ trợ khôi phục lịch sử)
exports.searchUsers = catchAsync(async (req, res, next) => {
  const keyword = req.query.q || '';

  const query = { role: 'user' };

  if (keyword.includes(',')) {
    // Nếu là danh sách ID (khi khôi phục từ localStorage)
    const ids = keyword.split(',').map(id => id.trim());
    query._id = { $in: ids };
  } else {
    // Nếu là từ khóa tìm kiếm
    query.$or = [
      { name: { $regex: keyword, $options: 'i' } },
      { email: { $regex: keyword, $options: 'i' } }
    ];
  }

  const users = await User.find(query)
    .select('_id name email')
    .limit(10);

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: { users }
  });
});
