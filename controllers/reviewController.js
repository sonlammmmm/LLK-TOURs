const Review = require('../models/reviewModel');
const Booking = require('../models/bookingModel');
const Tour = require('../models/tourModel');
const factory = require('./handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.setTourUserIds = (req, res, next) => {
  // Cho phép các ROUTE lồng nhau
  if (!req.body.tour) req.body.tour = req.params.tourId;
  if (!req.body.user) req.body.user = req.user.id;
  next();
};

//Middleware kiểm tra xem người dùng có thể đánh giá tour không
exports.checkCanReview = catchAsync(async (req, res, next) => {
  const tourId = req.body.tour || req.params.tourId;
  const userId = req.user.id;

  // 1) Kiểm tra xem người dùng đã đặt tour này chưa
  const booking = await Booking.findOne({
    tour: tourId,
    user: userId
  });

  if (!booking) {
    return next(
      new AppError('Bạn chỉ có thể đánh giá tour mà bạn đã đặt.', 400)
    );
  }

  // 2) Lấy thông tin tour để tính ngày kết thúc
  const tour = await Tour.findById(tourId);
  if (!tour) {
    return next(new AppError('Không tìm thấy tour.', 404));
  }

  // 3) Tính ngày kết thúc tour dựa trên ngày khởi hành của booking
  const bookingStartDate = new Date(booking.startDate);
  const tourEndDate = new Date(bookingStartDate);
  tourEndDate.setDate(tourEndDate.getDate() + tour.duration);
  tourEndDate.setHours(23, 59, 59, 999); // Đặt về cuối ngày

  // 4) Kiểm tra xem tour đã kết thúc chưa
  const today = new Date();
  if (today <= tourEndDate) {
    return next(
      new AppError('Bạn chỉ có thể đánh giá sau khi tour kết thúc.', 400)
    );
  }

  // 5) Kiểm tra xem đã đánh giá chưa (chỉ cho phép 1 đánh giá per user per tour)
  const existingReview = await Review.findOne({
    tour: tourId,
    user: userId
  });

  if (existingReview && req.method === 'POST') {
    return next(new AppError('Bạn đã đánh giá tour này rồi.', 400));
  }

  next();
});

exports.checkReviewOwnership = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError('Không tìm thấy đánh giá.', 404));
  }

  // Chỉ cho phép chủ sở hữu hoặc admin sửa/xóa
  if (review.user.id !== req.user.id && req.user.role !== 'admin') {
    return next(
      new AppError('Bạn chỉ có thể sửa/xóa đánh giá của chính mình.', 403)
    );
  }

  next();
});

exports.getAllReviews = factory.getAll(Review);
exports.getReview = factory.getOne(Review);

exports.createReview = catchAsync(async (req, res, next) => {
  // Gọi middleware kiểm tra trước khi tạo
  await exports.checkCanReview(req, res, () => {});

  return factory.createOne(Review)(req, res, next);
});

exports.updateReview = catchAsync(async (req, res, next) => {
  await exports.checkReviewOwnership(req, res, () => {});
  return factory.updateOne(Review)(req, res, next);
});

exports.deleteReview = catchAsync(async (req, res, next) => {
  await exports.checkReviewOwnership(req, res, () => {});
  return factory.deleteOne(Review)(req, res, next);
});
