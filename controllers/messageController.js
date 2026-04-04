const Message = require('../schemas/messageModel');
const User = require('../schemas/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// ==================== TRANG CHAT (RENDER VIEW) ====================

// Trang admin chat
exports.getAdminChatView = catchAsync(async (req, res) => {
  res.status(200).render('adminChat', {
    title: 'Chat khách hàng',
    adminMenuActive: 'chat'
  });
});

// Trang user chat
exports.getUserChatView = catchAsync(async (req, res) => {
  // Lấy toàn bộ tin của user này, không cần chọn 1 admin
  const userId = req.user._id;
  const userAvatar = req.user?.photo
    ? `/img/users/${req.user.photo}`
    : '/img/users/default.jpg';

  const messages = await Message.find({
    $or: [{ sender: userId }, { receiver: userId }]
  })
    .sort({ createdAt: 1 })
    .lean();

  const adminIds = [
    ...new Set(
      messages.filter(m => m.role === 'admin').map(m => m.sender.toString())
    )
  ];

  const admins =
    adminIds.length > 0
      ? await User.find({ _id: { $in: adminIds } })
          .select('name photo')
          .lean()
      : [];

  const fallbackAdminAvatar = '/img/users/default.jpg';
  const adminAvatarMap = admins.reduce((acc, admin) => {
    acc[admin._id.toString()] = admin.photo
      ? `/img/users/${admin.photo}`
      : fallbackAdminAvatar;
    return acc;
  }, {});

  const lastAdminMessage = messages.filter(m => m.role === 'admin').pop();
  const activeAdminId = lastAdminMessage
    ? lastAdminMessage.sender.toString()
    : adminIds[0];
  const activeAdmin =
    activeAdminId &&
    admins.find(admin => admin._id.toString() === activeAdminId);

  const partnerInfo = {
    name: activeAdmin?.name || 'Admin LLK',
    avatar: activeAdmin
      ? adminAvatarMap[activeAdmin._id.toString()]
      : fallbackAdminAvatar,
    status: 'Thường phản hồi trong vài phút'
  };

  const serialized = messages.map(m => {
    const senderId = m.sender.toString();
    return {
      sender: senderId,
      receiver: m.receiver.toString(),
      senderName: m.senderName,
      receiverName: m.receiverName,
      content: m.content,
      role: m.role,
      createdAt: m.createdAt,
      senderAvatar:
        m.role === 'admin'
          ? adminAvatarMap[senderId] || fallbackAdminAvatar
          : userAvatar
    };
  });

  res.status(200).render('chat', {
    title: 'Chat với admin',
    user: req.user,
    messages: serialized,
    chatPartner: partnerInfo,
    adminAvatarMap,
    fallbackAdminAvatar,
    userAvatar
  });
});

// ==================== API CHAT ====================

// API: lịch sử hội thoại của 1 user cụ thể (cho admin UI)
exports.getChatHistory = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  if (
    req.user.role !== 'admin' &&
    req.user._id.toString() !== userId.toString()
  ) {
    return next(
      new AppError('Bạn không có quyền xem lịch sử chat của người khác.', 403)
    );
  }
  const messages = await Message.find({
    $or: [{ sender: userId }, { receiver: userId }]
  }).sort({ createdAt: 1 });

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: { messages }
  });
});

// API: Danh sách user có hội thoại, gom theo userId (phân trang)
exports.getUsersWithMessages = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 8;
  const skip = (page - 1) * limit;

  const agg = await Message.aggregate([
    {
      $addFields: {
        userId: {
          $cond: [{ $eq: ['$role', 'user'] }, '$sender', '$receiver']
        }
      }
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$userId',
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
    'name email role photo'
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
            photo: u.photo,
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

// API: Tìm kiếm user theo tên, email hoặc danh sách ID (hỗ trợ khôi phục lịch sử)
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
    .select('_id name email photo')
    .limit(10);

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: { users }
  });
});
