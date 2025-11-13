const Promotion = require('../models/promotionModel');
const UserPromotion = require('../models/userPromotionModel');
const AppError = require('./appError');

const normalizeCode = code =>
  typeof code === 'string' ? code.trim().toUpperCase() : '';

const ensureAssignmentStatus = async assignment => {
  if (!assignment) return null;
  const now = new Date();

  if (assignment.expiresAt && assignment.expiresAt < now) {
    assignment.status = 'expired';
    await assignment.save();
    return null;
  }

  if (assignment.status === 'revoked') {
    return null;
  }

  return assignment;
};

exports.validatePromotionForUser = async ({ code, userId, orderAmount }) => {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) return { discountAmount: 0 };

  const promotion = await Promotion.findOne({ code: normalizedCode });
  if (!promotion) {
    throw new AppError('Mã khuyến mãi không tồn tại.', 404);
  }

  const now = new Date();
  if (!promotion.isCurrentlyActive(now)) {
    throw new AppError('Mã khuyến mãi hiện không khả dụng.', 400);
  }

  if (promotion.minOrderAmount && orderAmount < promotion.minOrderAmount) {
    throw new AppError(
      `Giá trị đơn hàng phải từ ${promotion.minOrderAmount.toLocaleString(
        'vi-VN'
      )}đ để áp dụng mã.`,
      400
    );
  }

  let assignment = await UserPromotion.findOne({
    promotion: promotion._id,
    user: userId
  });
  assignment = await ensureAssignmentStatus(assignment);

  if (promotion.audience === 'targeted' && !assignment) {
    throw new AppError('Mã này chưa được gắn cho tài khoản của bạn.', 403);
  }

  if (assignment) {
    if (
      assignment.usageLimit &&
      assignment.usageCount >= assignment.usageLimit
    ) {
      assignment.status = 'used';
      await assignment.save();
      throw new AppError('Bạn đã sử dụng hết lượt của mã này.', 400);
    }
  }

  const perUserLimit = assignment?.usageLimit || promotion.perUserLimit || 1;
  if (perUserLimit && assignment?.usageCount >= perUserLimit) {
    throw new AppError('Bạn đã sử dụng hết lượt của mã này.', 400);
  }

  let discountAmount = 0;
  if (promotion.discountType === 'percent') {
    discountAmount = (orderAmount * promotion.discountValue) / 100;
  } else {
    discountAmount = promotion.discountValue;
  }

  if (promotion.maxDiscountAmount) {
    discountAmount = Math.min(discountAmount, promotion.maxDiscountAmount);
  }

  discountAmount = Math.floor(Math.min(discountAmount, orderAmount));

  return {
    promotion,
    userPromotion: assignment || null,
    discountAmount,
    normalizedCode,
    perUserLimit
  };
};

exports.recordPromotionUsage = async ({
  promotionId,
  userPromotionId,
  userId,
  discountAmount = 0,
  code
}) => {
  if (!promotionId) return null;

  const promotion = await Promotion.findByIdAndUpdate(
    promotionId,
    {
      $inc: {
        usedCount: 1,
        totalDiscountGiven: Math.max(discountAmount, 0)
      }
    },
    { new: true }
  );

  if (!promotion) return null;

  let assignment = null;

  if (userPromotionId) {
    assignment = await UserPromotion.findById(userPromotionId);
    if (assignment) {
      assignment.usageCount += 1;
      assignment.status =
        assignment.usageLimit && assignment.usageCount >= assignment.usageLimit
          ? 'used'
          : 'active';
      await assignment.save();
    }
    return { promotion, assignment };
  }

  if (promotion.audience !== 'public' || !userId) {
    return { promotion };
  }

  assignment = await UserPromotion.findOne({
    promotion: promotionId,
    user: userId
  });

  if (!assignment) {
    assignment = await UserPromotion.create({
      promotion: promotionId,
      user: userId,
      code: code || promotion.code,
      usageLimit: promotion.perUserLimit || 1,
      usageCount: 1,
      status:
        promotion.perUserLimit && promotion.perUserLimit <= 1
          ? 'used'
          : 'active',
      expiresAt: promotion.endDate
    });
    return { promotion, assignment };
  }

  assignment.usageCount += 1;
  assignment.status =
    assignment.usageLimit && assignment.usageCount >= assignment.usageLimit
      ? 'used'
      : 'active';
  await assignment.save();

  return { promotion, assignment };
};
