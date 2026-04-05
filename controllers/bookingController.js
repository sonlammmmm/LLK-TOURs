/* eslint-disable unicode-bom */
const axios = require('axios');
const mongoose = require('mongoose');
const Booking = require('../schemas/bookingModel');
const Promotion = require('../schemas/promotionModel');
const UserPromotion = require('../schemas/userPromotionModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');
const { formatRecentOrderCard } = require('../utils/dashboardFeed');
const {
  linkSessionToSoftLock,
  updateSoftLockMeta
} = require('../utils/bookingSoftLock');
const {
  stripeClient,
  momoConfig,
  releaseSoftLockSafely,
  preparePaymentInitialization,
  buildStripeRedirectUrls,
  buildLineItems,
  createDiscountCoupon,
  buildSessionMetadata,
  createBookingFromStripeSession,
  buildHoldBookingPayload,
  buildMomoRedirectUrl,
  buildMomoIpnUrl,
  buildMomoCreateSignature,
  processMomoCallback,
  createCashBookingWithTransaction
} = require('../utils/bookingPayments');

// Populate fields cho booking session
const bookingSessionPopulate = [
  { path: 'tour', select: 'name startDates duration' },
  { path: 'user', select: 'name email' }
];

// ==================== THANH TOÁN TIỀN MẶT (CASH) ====================

// Tạo booking bằng tiền mặt — dùng MongoDB Transaction thực sự vì toàn bộ logic nằm trong 1 request
exports.createCashBooking = catchAsync(async (req, res, next) => {
  let context;
  try {
    context = await preparePaymentInitialization(req, { useSoftLock: false });
  } catch (err) {
    return next(err);
  }

  let booking;
  try {
    booking = await createCashBookingWithTransaction(req, context);
  } catch (err) {
    return next(err);
  }

  if (!booking) {
    return next(new AppError('Không thể tạo booking. Vui lòng thử lại.', 500));
  }

  res.status(201).json({
    status: 'success',
    data: { booking }
  });
});

// ==================== THANH TOÁN STRIPE ====================

// Tạo Stripe Checkout Session để thanh toán tour
exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  let context;

  try {
    context = await preparePaymentInitialization(req);
  } catch (err) {
    return next(err);
  }

  const { tour, startKey, platform, pricing, softLockRecord } = context;

  const { successUrl, cancelUrl } = buildStripeRedirectUrls(platform);
  const lineItems = buildLineItems(tour, pricing, req);
  const couponId = await createDiscountCoupon(pricing.discountAmount);
  const metadata = buildSessionMetadata(
    req,
    tour,
    pricing,
    startKey,
    platform,
    {
      softLockId: softLockRecord?.id || ''
    }
  );

  let session;

  try {
    session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: req.user.email,
      client_reference_id: req.params.tourId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: lineItems,
      metadata,
      discounts: couponId ? [{ coupon: couponId }] : undefined
    });
  } catch (err) {
    await releaseSoftLockSafely(softLockRecord, 'stripe-session-error');

    console.error('[Stripe] Create session failed', {
      message: err.message,
      statusCode: err.statusCode,
      stack: err.stack
    });

    return next(
      new AppError(err.message || 'Stripe error', err.statusCode || 500)
    );
  }

  if (softLockRecord && session?.id) {
    try {
      await linkSessionToSoftLock(softLockRecord.id, session.id);
    } catch (linkErr) {
      console.error(
        '[SoftLock] Không thể gắn phiên thanh toán:',
        linkErr.message
      );
    }
  }
  res.status(200).json({ status: 'success', session });
});

// ==================== THANH TOÁN MOMO ====================

// Tạo giao dịch thanh toán MoMo
exports.createMomoPayment = catchAsync(async (req, res, next) => {
  let context;
  try {
    context = await preparePaymentInitialization(req, { useSoftLock: false });
  } catch (err) {
    return next(err);
  }

  const { tour, pricing, platform, softLockRecord } = context;
  const amount = Math.max(Math.round(Number(pricing.grandTotal) || 0), 0);

  if (amount <= 0) {
    await releaseSoftLockSafely(softLockRecord, 'momo-invalid-amount');
    return next(new AppError('Tổng thanh toán qua MoMo phải lớn hơn 0.', 400));
  }

  const {
    endpoint: momoEndpoint,
    partnerCode,
    partnerName,
    storeId,
    requestType,
    paymentCode,
    autoCapture,
    lang
  } = momoConfig;

  const orderId = `${partnerCode}${Date.now()}`;
  const requestId = orderId;
  const extraData = softLockRecord?.id ? softLockRecord.id.toString() : '';
  const bookingPayload = buildHoldBookingPayload(req, context);

  const requestBody = {
    partnerCode,
    partnerName,
    storeId,
    requestId,
    amount: String(amount),
    orderId,
    orderInfo: `Thanh toán tour ${tour.name}`,
    redirectUrl: buildMomoRedirectUrl(req),
    ipnUrl: buildMomoIpnUrl(req),
    lang,
    requestType,
    autoCapture,
    extraData,
    orderGroupId: ''
  };

  if (paymentCode) {
    requestBody.paymentCode = paymentCode;
  }

  requestBody.signature = buildMomoCreateSignature(requestBody);

  let momoGatewayPayload;

  try {
    const response = await axios.post(momoEndpoint, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    momoGatewayPayload = response.data || {};
    if (momoGatewayPayload.resultCode !== 0 || !momoGatewayPayload.payUrl) {
      throw new AppError(
        momoGatewayPayload.message || 'MoMo từ chối tạo giao dịch.',
        400
      );
    }
  } catch (err) {
    await releaseSoftLockSafely(softLockRecord, 'momo-session-error');
    if (err instanceof AppError) {
      return next(err);
    }
    const responseMessage = err.response?.data?.message || err.message;
    return next(
      new AppError(responseMessage || 'MoMo từ chối tạo giao dịch.', 500)
    );
  }

  if (softLockRecord) {
    try {
      await linkSessionToSoftLock(softLockRecord.id, orderId);
      await updateSoftLockMeta(softLockRecord.id, {
        bookingPayload,
        momo: {
          orderId,
          requestId,
          amount,
          platform
        }
      });
    } catch (linkErr) {
      console.warn(
        '[MoMo] Unable to persist booking payload:',
        linkErr.message
      );
    }
  }

  return res.status(200).json({
    status: 'success',
    data: {
      orderId,
      requestId,
      payUrl: momoGatewayPayload.payUrl,
      deeplink: momoGatewayPayload.deeplink,
      qrCodeUrl: momoGatewayPayload.qrCodeUrl,
      resultCode: momoGatewayPayload.resultCode,
      message: momoGatewayPayload.message
    }
  });
});

// Xử lý MoMo IPN callback (server-to-server)
exports.handleMomoIpn = async (req, res) => {
  try {
    await processMomoCallback(req.body || {}, 'ipn');
    return res.status(200).json({ resultCode: 0, message: 'success' });
  } catch (err) {
    console.error('[MoMo] IPN error:', err);
    return res
      .status(500)
      .json({ resultCode: 99, message: err.message || 'Server error' });
  }
};

// Xử lý MoMo redirect callback (user quay về từ MoMo)
exports.handleMomoRedirect = async (req, res) => {
  const query = req.query || {};
  const { orderId, resultCode: resultCodeRaw } = query;
  const resultCode = Number(resultCodeRaw);

  if (orderId && resultCode === 0) {
    try {
      await processMomoCallback(query, 'redirect');
    } catch (err) {
      console.error('[MoMo] Redirect processing error:', err.message);
    }
  }

  const baseUrl = process.env.PUBLIC_SUCCESS_URL || '/booking-success';
  const params = new URLSearchParams({ provider: 'momo' });
  if (orderId) params.set('sid', orderId);
  if (typeof query.resultCode !== 'undefined')
    params.set('resultCode', query.resultCode);
  if (query.message) params.set('message', query.message);
  const connector = baseUrl.includes('?') ? '&' : '?';
  res.redirect(`${baseUrl}${connector}${params.toString()}`);
};

// ==================== CRUD BOOKING ====================

// Admin: Tạo booking thủ công
exports.createBooking = factory.createOne(Booking);

// Admin: Lấy chi tiết 1 booking
exports.getBooking = factory.getOne(Booking);

// Admin: Lấy tất cả booking
exports.getAllBookings = factory.getAll(Booking);

// Dashboard: Lấy danh sách booking gần đây (feed)
exports.getRecentBookingFeed = catchAsync(async (req, res) => {
  const limitRaw = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 15)
    : 6;

  const bookings = await Booking.find()
    .sort('-createdAt')
    .limit(limit)
    .lean();

  const orders = bookings.map(formatRecentOrderCard).filter(Boolean);

  res.status(200).json({
    status: 'success',
    results: orders.length,
    data: { orders }
  });
});

// User: Lấy danh sách booking của mình (có phân trang)
exports.getMyBookings = catchAsync(async (req, res, next) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const skip = (page - 1) * limit;

  const filter = { user: req.user.id };
  if (typeof req.query.paid !== 'undefined') {
    filter.paid = req.query.paid === 'true';
  }

  const [items, total] = await Promise.all([
    Booking.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'tour',
        select: 'name slug imageCover duration price'
      })
      .select('-__v'),
    Booking.countDocuments(filter)
  ]);

  res.status(200).json({
    status: 'success',
    results: items.length,
    page,
    total,
    data: items
  });
});

// Lấy booking theo Stripe session ID (dùng cho trang booking-success)
exports.getByStripeSession = catchAsync(async (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  const { sid } = req.params;
  if (!sid) {
    return res.status(200).json({ status: 'pending' });
  }

  let booking = await Booking.findOne({
    paymentMethod: 'stripe',
    providerSessionId: sid
  }).populate(bookingSessionPopulate);

  if (!booking) {
    const created = await createBookingFromStripeSession(sid);
    if (created) {
      booking = await Booking.findById(created._id).populate(
        bookingSessionPopulate
      );
    }
  }

  if (!booking) {
    return res.status(200).json({ status: 'pending' });
  }

  const bookingUserId =
    booking.user && booking.user.id
      ? booking.user.id.toString()
      : booking.user?.toString();

  if (bookingUserId && bookingUserId !== req.user.id.toString()) {
    return res.status(403).json({
      status: 'forbidden',
      message: 'Bạn không thể truy cập booking của người khác.'
    });
  }

  res.status(200).json({ status: 'success', data: booking });
});

// Admin: Cập nhật booking
exports.updateBooking = catchAsync(async (req, res, next) => {
  const existing = await Booking.findById(req.params.id);

  if (!existing) {
    return next(new AppError('Không tìm thấy tài liệu với ID này', 404));
  }

  const isCashConfirm =
    existing.paymentMethod === 'cash' &&
    existing.paid === false &&
    req.body?.paid === true;

  if (!isCashConfirm) {
    const doc = await Booking.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!doc) {
      return next(new AppError('Không tìm thấy tài liệu với ID này', 404));
    }

    return res.status(200).json({
      status: 'success',
      data: {
        data: doc
      }
    });
  }

  const session = await mongoose.startSession();
  let updatedBooking;

  try {
    await session.withTransaction(async () => {
      updatedBooking = await Booking.findByIdAndUpdate(existing.id, req.body, {
        new: true,
        runValidators: true,
        session
      });

      const promoSnap = existing.promotionSnapshot;
      if (promoSnap?.promotion) {
        await Promotion.findByIdAndUpdate(
          promoSnap.promotion,
          {
            $inc: {
              usedCount: 1,
              totalDiscountGiven: Math.max(existing.discountAmount || 0, 0)
            }
          },
          { session }
        );

        if (promoSnap.userPromotion) {
          const uPromo = await UserPromotion.findById(
            promoSnap.userPromotion
          ).session(session);
          if (uPromo) {
            uPromo.usageCount += 1;
            uPromo.status =
              uPromo.usageLimit && uPromo.usageCount >= uPromo.usageLimit
                ? 'used'
                : 'active';
            await uPromo.save({ session });
          }
        }
      }
    });
  } finally {
    await session.endSession();
  }

  if (!updatedBooking) {
    return next(new AppError('Không thể cập nhật booking.', 500));
  }

  return res.status(200).json({
    status: 'success',
    data: {
      data: updatedBooking
    }
  });
});

// Admin: Xóa booking
exports.deleteBooking = factory.deleteOne(Booking);
