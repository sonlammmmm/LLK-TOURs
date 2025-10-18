const Message = require('../models/messageModel');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');

// Trang admin chat
exports.getAdminChatView = catchAsync(async (req, res) => {
  res.status(200).render('adminChat', { title: 'Chat khách hàng' });
});

// Trang user chat
exports.getUserChatView = catchAsync(async (req, res) => {
  // Lấy toàn bộ tin của user này, không cần chọn 1 admin
  const userId = req.user._id;
  const messages = await Message.find({
    $or: [{ sender: userId }, { receiver: userId }]
  }).sort({ createdAt: 1 });

  const serialized = messages.map(m => ({
    sender: m.sender.toString(),
    receiver: m.receiver.toString(),
    senderName: m.senderName,
    receiverName: m.receiverName,
    content: m.content,
    role: m.role,
    createdAt: m.createdAt
  }));

  res.status(200).render('chat', {
    title: 'Chat với admin',
    user: req.user,
    // không cần truyền adminId cố định nữa
    messages: serialized
  });
});

// API: lịch sử hội thoại của 1 user cụ thể (cho admin UI)
exports.getChatHistory = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const messages = await Message.find({
    $or: [{ sender: userId }, { receiver: userId }]
  }).sort({ createdAt: 1 });

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: { messages }
  });
});

// API: danh sách user có hội thoại, gom theo receiver = userId
exports.getUsersWithMessages = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 8;
  const skip = (page - 1) * limit;

  const agg = await Message.aggregate([
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$receiver', // receiver luôn là userId
        lastMessage: { $first: '$content' },
        lastMessageTime: { $first: '$createdAt' }
      }
    },
    { $sort: { lastMessageTime: -1 } },
    { $skip: skip },
    { $limit: limit }
  ]);

  const userIds = agg.map(a => a._id).filter(Boolean);
  const users = await User.find({ _id: { $in: userIds }, role: 'user' }).select(
    'name email role'
  );

  const map = new Map(users.map(u => [u._id.toString(), u]));
  const result = agg
    .map(item => {
      const u = map.get((item._id || '').toString());
      return u
        ? {
            _id: u._id,
            name: u.name,
            email: u.email,
            lastMessage: item.lastMessage,
            lastMessageTime: item.lastMessageTime
          }
        : null;
    })
    .filter(Boolean);

  const totalUsersAgg = await Message.aggregate([
    { $group: { _id: '$receiver' } },
    { $count: 'total' }
  ]);
  const total = totalUsersAgg[0]?.total || 0;
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

//Tìm kiếm user theo tên, email, hoặc ID (hỗ trợ khôi phục lịch sử)
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
