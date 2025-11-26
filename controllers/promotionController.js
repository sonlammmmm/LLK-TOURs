const Promotion = require('../models/promotionModel');
const UserPromotion = require('../models/userPromotionModel');
const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');
const { buildBookingFinancials } = require('../utils/bookingPricing');

exports.getPromotions = factory.getAll(Promotion);
exports.getPromotion = factory.getOne(Promotion);
exports.createPromotion = factory.createOne(Promotion);
exports.updatePromotion = factory.updateOne(Promotion);

exports.deletePromotion = catchAsync(async (req, res, next) => {
  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) {
    return next(new AppError('Không tìm thấy khuyến mãi.', 404));
  }

  if (promotion.usedCount > 0) {
    promotion.status = 'archived';
    await promotion.save();
    return res.status(200).json({
      status: 'success',
      message: 'Khuyến mãi đã được lưu trữ do đã phát sinh giao dịch.',
      data: { data: promotion }
    });
  }

  await promotion.deleteOne();
  return res.status(204).json({ status: 'success', data: null });
});

exports.assignPromotionToUser = catchAsync(async (req, res, next) => {
  const { userId, userIds, usageLimit, expiresAt, note, customCode } = req.body;

  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) {
    return next(new AppError('Không tìm thấy khuyến mãi.', 404));
  }

  const parsedLimit =
    Number.parseInt(usageLimit, 10) || promotion.perUserLimit || 1;
  let parsedExpire = promotion.endDate;
  if (expiresAt) {
    const expireDate = new Date(expiresAt);
    if (!Number.isNaN(expireDate.getTime())) {
      parsedExpire = expireDate;
    }
  }

  const processedUserIds = (() => {
    if (Array.isArray(userIds)) {
      return userIds;
    }
    if (typeof userIds === 'string' && userIds.length) {
      return [userIds];
    }
    return [];
  })();

  const normalizedIds = new Set([...processedUserIds, userId].filter(Boolean));

  if (!normalizedIds.size) {
    return next(new AppError('Vui lòng chọn người dùng hợp lệ.', 400));
  }

  const users = await User.find({ _id: { $in: Array.from(normalizedIds) } });
  if (!users.length) {
    return next(new AppError('Không tìm thấy người dùng.', 404));
  }

  const assignments = await Promise.all(
    users.map(user =>
      UserPromotion.findOneAndUpdate(
        { promotion: promotion._id, user: user._id },
        {
          promotion: promotion._id,
          user: user._id,
          code: (customCode || promotion.code || '').toUpperCase(),
          usageLimit: parsedLimit,
          expiresAt: parsedExpire,
          note,
          assignedBy: req.user.id,
          status: 'active'
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      )
    )
  );

  res.status(200).json({
    status: 'success',
    data: { assignments }
  });
});

exports.getMyPromotions = catchAsync(async (req, res, next) => {
  const now = new Date();
  const assignments = await UserPromotion.find({
    user: req.user.id,
    status: { $in: ['assigned', 'active'] },
    $or: [{ expiresAt: null }, { expiresAt: { $gte: now } }]
  })
    .populate({
      path: 'promotion',
      match: { status: { $nin: ['archived', 'inactive'] } }
    })
    .sort('-createdAt');

  const filtered = assignments.filter(item => !!item.promotion);

  res.status(200).json({
    status: 'success',
    results: filtered.length,
    data: filtered
  });
});

exports.previewBookingPromotion = catchAsync(async (req, res, next) => {
  const { tourId, participants, selectedServices, promotionCode } = req.body;

  const tour = await Tour.findById(tourId);
  if (!tour) {
    return next(new AppError('Không tìm thấy tour.', 404));
  }

  const financials = await buildBookingFinancials({
    tour,
    participants,
    selectedServices,
    promotionCode,
    userId: req.user.id
  });

  res.status(200).json({
    status: 'success',
    data: {
      discountAmount: financials.discountAmount,
      subtotal: financials.subtotal,
      servicesTotal: financials.servicesTotal,
      grandTotal: financials.grandTotal,
      promotion: financials.promotion
        ? {
            id: financials.promotion.id,
            code: financials.promotion.code,
            name: financials.promotion.name,
            discountType: financials.promotion.discountType,
            discountValue: financials.promotion.discountValue,
            maxDiscountAmount: financials.promotion.maxDiscountAmount
          }
        : null
    }
  });
});
