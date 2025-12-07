const Review = require('../models/reviewModel');
const Booking = require('../models/bookingModel');
const Tour = require('../models/tourModel');
const factory = require('./handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const { formatReviewCard } = require('../utils/dashboardFeed');

const getReviewerId = review => {
  if (!review || !review.user) return null;
  if (review.user.id) return review.user.id.toString();
  if (review.user._id) return review.user._id.toString();
  if (typeof review.user === 'string') return review.user;
  if (typeof review.user.toString === 'function') return review.user.toString();
  return null;
};

const isReviewOwner = (review, userId) => {
  if (!review || !userId) return false;
  const reviewerId = getReviewerId(review);
  return reviewerId === userId.toString();
};

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
  if (!isReviewOwner(review, req.user.id) && req.user.role !== 'admin') {
    return next(
      new AppError('Bạn chỉ có thể sửa/xóa đánh giá của chính mình.', 403)
    );
  }

  next();
});

exports.getLatestReviewFeed = catchAsync(async (req, res) => {
  const includeHidden = req.query.includeHidden === 'true';
  const limitRaw = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 20)
    : 6;

  const filter = {};
  if (!includeHidden) {
    filter.isHidden = { $ne: true };
  }

  const reviews = await Review.find(filter)
    .sort('-createdAt')
    .limit(limit)
    .populate({ path: 'tour', select: 'name slug' })
    .lean();

  const formatted = reviews.map(formatReviewCard).filter(Boolean);

  res.status(200).json({
    status: 'success',
    results: formatted.length,
    data: { reviews: formatted }
  });
});

exports.getAllReviews = catchAsync(async (req, res, next) => {
  const filter = {};
  if (req.params.tourId) filter.tour = req.params.tourId;

  if (!req.user || req.user.role !== 'admin') {
    filter.$or = [{ isHidden: { $ne: true } }];
    if (req.user) {
      filter.$or.push({ user: req.user.id });
    }
  }

  const features = new APIFeatures(Review.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const reviews = await features.query
    .populate({ path: 'user', select: 'name photo' })
    .populate({ path: 'tour', select: 'name' });

  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: {
      data: reviews
    }
  });
});

exports.getReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError('Không tìm thấy đánh giá', 404));
  }

  const isVisible =
    !review.isHidden ||
    (req.user &&
      (req.user.role === 'admin' || isReviewOwner(review, req.user.id)));

  if (!isVisible) {
    return next(new AppError('Đánh giá này đang bị ẩn bởi quản trị viên', 403));
  }

  res.status(200).json({
    status: 'success',
    data: {
      data: review
    }
  });
});

exports.createReview = catchAsync(async (req, res, next) => {
  // Gọi middleware kiểm tra trước khi tạo
  await exports.checkCanReview(req, res, () => {});

  return factory.createOne(Review)(req, res, next);
});

exports.updateReview = catchAsync(async (req, res, next) => {
  await exports.checkReviewOwnership(req, res, () => {});

  if (
    Object.prototype.hasOwnProperty.call(req.body, 'isHidden') &&
    req.user.role !== 'admin'
  ) {
    delete req.body.isHidden;
  } else if (Object.prototype.hasOwnProperty.call(req.body, 'isHidden')) {
    req.body.isHidden =
      req.body.isHidden === true || req.body.isHidden === 'true';
  }

  return factory.updateOne(Review)(req, res, next);
});

exports.deleteReview = catchAsync(async (req, res, next) => {
  await exports.checkReviewOwnership(req, res, () => {});
  return factory.deleteOne(Review)(req, res, next);
});
