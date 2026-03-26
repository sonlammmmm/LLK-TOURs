const ContactMessage = require('../models/contactMessageModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// Public: Gửi tin nhắn liên hệ (không cần đăng nhập)
exports.submitContactMessage = catchAsync(async (req, res, next) => {
  const { name, email, phone, subject, message } = req.body;

  const contact = await ContactMessage.create({
    name,
    email,
    phone,
    subject,
    message
  });

  res.status(201).json({
    status: 'success',
    message: 'Tin nhắn đã được gửi thành công! Chúng tôi sẽ phản hồi sớm nhất.',
    data: { data: contact }
  });
});

// Admin: Lấy tất cả tin nhắn
exports.getAllContactMessages = catchAsync(async (req, res, next) => {
  const messages = await ContactMessage.find().sort({ isRead: 1, createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: messages.length,
    data: { data: messages }
  });
});

// Admin: Lấy 1 tin nhắn
exports.getContactMessage = catchAsync(async (req, res, next) => {
  const message = await ContactMessage.findById(req.params.id);

  if (!message) {
    return next(new AppError('Không tìm thấy tin nhắn.', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { data: message }
  });
});

// Admin: Đánh dấu đã đọc
exports.markAsRead = catchAsync(async (req, res, next) => {
  const message = await ContactMessage.findById(req.params.id);

  if (!message) {
    return next(new AppError('Không tìm thấy tin nhắn.', 404));
  }

  message.isRead = true;
  await message.save();

  res.status(200).json({
    status: 'success',
    data: { data: message }
  });
});

// Admin: Xóa tin nhắn
exports.deleteContactMessage = catchAsync(async (req, res, next) => {
  const message = await ContactMessage.findByIdAndDelete(req.params.id);

  if (!message) {
    return next(new AppError('Không tìm thấy tin nhắn.', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});
