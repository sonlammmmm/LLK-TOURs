const FAQ = require('../models/faqModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

// Lấy tất cả FAQ đang hoạt động (public)
exports.getActiveFaqs = catchAsync(async (req, res, next) => {
  const faqs = await FAQ.find({ active: true }).sort({
    displayOrder: 1,
    createdAt: -1
  });

  res.status(200).json({
    status: 'success',
    results: faqs.length,
    data: { data: faqs }
  });
});

// Admin: Lấy tất cả FAQ
exports.getAllFaqs = catchAsync(async (req, res, next) => {
  const faqs = await FAQ.find().sort({ displayOrder: 1, createdAt: -1 });

  res.status(200).json({
    status: 'success',
    results: faqs.length,
    data: { data: faqs }
  });
});

// Admin: Lấy 1 FAQ
exports.getFaq = factory.getOne(FAQ);

// Admin: Tạo FAQ
exports.createFaq = factory.createOne(FAQ);

// Admin: Cập nhật FAQ
exports.updateFaq = factory.updateOne(FAQ);

// Admin: Xóa FAQ
exports.deleteFaq = factory.deleteOne(FAQ);

// Admin: Bật/tắt trạng thái hiển thị
exports.toggleActive = catchAsync(async (req, res, next) => {
  const faq = await FAQ.findById(req.params.id);
  if (!faq) {
    return next(new AppError('Không tìm thấy câu hỏi FAQ.', 404));
  }

  faq.active = !faq.active;
  await faq.save();

  res.status(200).json({
    status: 'success',
    data: { data: faq }
  });
});
