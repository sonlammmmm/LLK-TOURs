const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('../models/bookingModel');
const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');
const { recordPromotionUsage } = require('../utils/promotionEngine');
const { buildBookingFinancials } = require('../utils/bookingPricing');

const bookingSessionPopulate = [
  { path: 'tour', select: 'name startDates duration' },
  { path: 'user', select: 'name email' }
];

const parseServicesFromMetadata = metadata => {
  if (!metadata || !metadata.services) return [];

  try {
    const payload = JSON.parse(metadata.services);
    if (!Array.isArray(payload)) return [];

    return payload
      .filter(item => item && item.quantity)
      .map(item => ({
        service: item.serviceId,
        name: item.name,
        chargeType: item.chargeType,
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
        total: Number(item.total || 0)
      }));
  } catch (err) {
    console.error('[STRIPE] Unable to parse services metadata:', err.message);
    return [];
  }
};

const normalizeStartDate = value => {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const buildPromotionSnapshot = metadata =>
  metadata && metadata.promotionCode
    ? {
        promotion: metadata.promotionId || undefined,
        userPromotion: metadata.userPromotionId || undefined,
        code: metadata.promotionCode,
        name: metadata.promotionName || '',
        discountType: metadata.promotionType || 'fixed',
        discountValue: Number(metadata.promotionValue || 0)
      }
    : undefined;

const findBookingBySessionId = sessionId =>
  Booking.findOne({
    paymentMethod: 'stripe',
    providerSessionId: sessionId
  });

const createBookingFromStripeSession = async sessionId => {
  if (!sessionId) return null;

  const existingBooking = await findBookingBySessionId(sessionId);
  if (existingBooking) return existingBooking;

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error('[STRIPE] Cannot retrieve session:', sessionId, err.message);
    return null;
  }

  if (!session || session.payment_status !== 'paid') {
    return null;
  }

  const metadata = session.metadata || {};
  if (!metadata.tourId || !metadata.userId) {
    console.warn('[STRIPE] Missing metadata for session:', sessionId);
    return null;
  }

  const participantsRaw = Number.parseInt(metadata.participants, 10);
  const participants =
    Number.isNaN(participantsRaw) || participantsRaw < 1 ? 1 : participantsRaw;

  const bookingPayload = {
    tour: metadata.tourId,
    user: metadata.userId,
    participants,
    startDate: normalizeStartDate(metadata.startDate),
    price: Number(metadata.grandTotal || session.amount_total || 0),
    paymentMethod: 'stripe',
    providerSessionId: session.id,
    paid: true,
    currency: (session.currency || 'vnd').toUpperCase(),
    basePrice: Number(metadata.basePrice || 0),
    services: parseServicesFromMetadata(metadata),
    servicesTotal: Number(metadata.servicesTotal || 0),
    subtotal: Number(metadata.subtotal || 0),
    discountAmount: Number(metadata.discountAmount || 0),
    promotionSnapshot: buildPromotionSnapshot(metadata)
  };

  let booking;
  let created = false;

  try {
    booking = await Booking.create(bookingPayload);
    created = true;
  } catch (err) {
    if (err.code === 11000) {
      booking = await findBookingBySessionId(session.id);
    } else {
      throw err;
    }
  }

  if (created && booking && (metadata.promotionId || metadata.promotionCode)) {
    await recordPromotionUsage({
      promotionId: metadata.promotionId,
      userPromotionId: metadata.userPromotionId,
      userId: metadata.userId,
      discountAmount: Number(metadata.discountAmount || 0),
      code: metadata.promotionCode || ''
    });
  }

  return booking;
};

const buildLineItems = (tour, pricing, req) => {
  const items = [];
  const imageUrl = tour.imageCover
    ? `${req.protocol}://${req.get('host')}/img/tours/${tour.imageCover}`
    : undefined;

  const baseAmount = Math.max(Math.round(Number(tour.price) || 0), 0);
  items.push({
    price_data: {
      currency: 'vnd',
      product_data: {
        name: `Tour ${tour.name}`,
        description: tour.summary || '',
        ...(imageUrl ? { images: [imageUrl] } : {})
      },
      unit_amount: baseAmount
    },
    quantity: pricing.participants
  });

  pricing.servicesPayload.forEach(service => {
    const quantity =
      service.chargeType === 'per-person'
        ? pricing.participants
        : Math.max(service.quantity || 1, 1);

    items.push({
      price_data: {
        currency: 'vnd',
        product_data: {
          name: service.name,
          description:
            service.chargeType === 'per-person'
              ? 'Tính trên mỗi khách'
              : 'Tính theo gói'
        },
        unit_amount: Math.max(Math.round(service.price || 0), 0)
      },
      quantity
    });
  });

  return items;
};

const buildSessionMetadata = (req, tour, pricing, startKey, platform) => ({
  userId: req.user.id.toString(),
  tourId: tour.id.toString(),
  participants: `${pricing.participants}`,
  startDate: startKey,
  platform,
  services: JSON.stringify(pricing.servicesPayload),
  servicesTotal: `${pricing.servicesTotal}`,
  basePrice: `${pricing.basePrice}`,
  subtotal: `${pricing.subtotal}`,
  discountAmount: `${pricing.discountAmount}`,
  grandTotal: `${pricing.grandTotal}`,
  promotionCode: pricing.promotionCode || '',
  promotionId: pricing.promotion?.id || '',
  userPromotionId: pricing.userPromotion?.id || '',
  promotionName: pricing.promotion?.name || '',
  promotionType: pricing.promotion?.discountType || '',
  promotionValue: `${pricing.promotion?.discountValue || ''}`,
  promotionAudience: pricing.promotion?.audience || '',
  promotionPerUserLimit: `${pricing.promotionPerUserLimit || ''}`
});

const createDiscountCoupon = async discount => {
  const amount = Math.max(Math.round(discount || 0), 0);
  if (amount < 1) return null;

  try {
    const coupon = await stripe.coupons.create({
      amount_off: amount,
      currency: 'vnd',
      duration: 'once',
      name: `PROMO-${Date.now()}`
    });
    return coupon.id;
  } catch (err) {
    console.error('[Stripe] Failed to create coupon', err);
    return null;
  }
};

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  if (!req.user?.id || !req.user?.email) {
    return next(new AppError('Bạn cần đăng nhập để thanh toán.', 401));
  }

  const tour = await Tour.findById(req.params.tourId);
  if (!tour) {
    return next(new AppError('Không tìm thấy tour.', 404));
  }

  const startDateStr = req.body.startDate || req.query.startDate;
  const participantsRaw =
    Number.parseInt(req.body.participants || req.query.participants, 10) || 1;
  const selectedServices =
    req.body.selectedServices || req.query.selectedServices || [];
  const platform = (
    req.body.platform ||
    req.query.platform ||
    'web'
  ).toLowerCase();

  if (!startDateStr) {
    return next(new AppError('Vui lòng chọn ngày khởi hành.', 400));
  }

  const startDate = new Date(startDateStr);
  if (Number.isNaN(startDate.getTime())) {
    return next(new AppError('Ngày khởi hành không hợp lệ.', 400));
  }

  const startKey = startDate.toISOString().split('T')[0];
  const dateItem =
    (tour.startDates || []).find(item => {
      const key =
        item && item.date
          ? new Date(item.date).toISOString().split('T')[0]
          : null;
      return key === startKey;
    }) || null;

  if (!dateItem) {
    return next(new AppError('Ngày khởi hành không tồn tại.', 400));
  }

  const maxSlots =
    Number.parseInt(dateItem.availableSlots || '', 10) || participantsRaw;
  const participants = Math.max(Math.min(participantsRaw, maxSlots), 1);

  if (Number(dateItem.availableSlots) < participants) {
    return next(
      new AppError(
        `Chỉ còn ${dateItem.availableSlots || 0} suất cho ngày này.`,
        400
      )
    );
  }

  console.log('[Stripe] Checkout session request', {
    tourId: req.params.tourId,
    userId: req.user.id,
    startDate: startKey,
    participants,
    platform
  });

  const pricing = await buildBookingFinancials({
    tour,
    participants,
    selectedServices,
    promotionCode:
      req.body.promotionCode ||
      req.body.promoCode ||
      req.query.promotionCode ||
      req.query.promoCode,
    userId: req.user.id
  });

  if (!pricing || !pricing.grandTotal) {
    return next(new AppError('Không thể tính được chi phí.', 400));
  }

  console.log('[Stripe] Pricing result', {
    subtotal: pricing.subtotal,
    discount: pricing.discountAmount,
    grandTotal: pricing.grandTotal,
    services: pricing.servicesPayload.length
  });

  const successUrl =
    platform === 'web'
      ? `${process.env.PUBLIC_SUCCESS_URL}?status=success&sid={CHECKOUT_SESSION_ID}`
      : `llktours://pay/success?sid={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    platform === 'web'
      ? `${process.env.PUBLIC_CANCEL_URL ||
          process.env.PUBLIC_SUCCESS_URL}?status=cancel`
      : `llktours://pay/cancel`;

  const lineItems = buildLineItems(tour, pricing, req);
  const couponId = await createDiscountCoupon(pricing.discountAmount);
  const metadata = buildSessionMetadata(req, tour, pricing, startKey, platform);

  let session;
  try {
    session = await stripe.checkout.sessions.create({
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
    console.log('[Stripe] Session object:', session);
  } catch (err) {
    console.error('[Stripe] Create session failed', {
      message: err.message,
      statusCode: err.statusCode,
      stack: err.stack
    });
    return next(
      new AppError(err.message || 'Stripe error', err.statusCode || 500)
    );
  }

  console.log(`[Stripe] Session created ${session.id}`);
  console.log('[Stripe] Sending response to client...');
  res.status(200).json({ status: 'success', session });
  console.log('[Stripe] Response sent successfully');
});

exports.createBookingCheckout = catchAsync(async (req, res, next) => {
  const { tour, user, price, participants, startDate } = req.query;

  if (!tour || !user || !price || !startDate) return next();

  const newBooking = await Booking.create({
    tour,
    user,
    price,
    participants: participants || 1,
    startDate: new Date(startDate)
  });

  return res.redirect(`/booking-success?booking=${newBooking._id}`);
});

exports.createBooking = factory.createOne(Booking);
exports.getBooking = factory.getOne(Booking);
exports.getAllBookings = factory.getAll(Booking);

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

  res.status(200).json({ status: 'success', data: booking });
});

exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);

exports.checkBookingExists = catchAsync(async (req, res, next) => {
  const { tourId } = req.params;
  const startDateStr = req.body.startDate || req.query.startDate;

  if (!tourId || !startDateStr) return next();

  const startDateObj = new Date(startDateStr);
  const dayStart = new Date(startDateObj);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(startDateObj);
  dayEnd.setHours(23, 59, 59, 999);

  const existingBooking = await Booking.findOne({
    tour: tourId,
    user: req.user.id,
    startDate: {
      $gte: dayStart,
      $lt: dayEnd
    }
  });

  if (existingBooking) {
    return next(
      new AppError('Bạn đã đặt tour này cho ngày khởi hành này rồi.', 400)
    );
  }

  next();
});
