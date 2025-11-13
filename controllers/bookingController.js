const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');
const { buildBookingFinancials } = require('../utils/bookingPricing');
const { recordPromotionUsage } = require('../utils/promotionEngine');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  if (!req.user || !req.user.id || !req.user.email) {
    return next(new AppError('Bạn cần đăng nhập trước khi thanh toán.', 401));
  }

  const tour = await Tour.findById(req.params.tourId);
  if (!tour) return next(new AppError('Không tìm thấy tour này.', 404));

  const startDateStr = req.body.startDate || req.query.startDate;
  const participantsRaw =
    Number.parseInt(req.body.participants || req.query.participants, 10) || 1;
  const participants = Math.max(participantsRaw, 1);

  if (!startDateStr) {
    return next(new AppError('Vui lòng chọn ngày khởi hành.', 400));
  }

  const startDate = new Date(startDateStr);
  if (Number.isNaN(startDate.getTime())) {
    return next(new AppError('Ngày khởi hành không hợp lệ.', 400));
  }

  const startKey = startDate.toISOString().split('T')[0];
  const dateItem = (tour.startDates || []).find(
    d => new Date(d.date).toISOString().split('T')[0] === startKey
  );

  if (!dateItem) {
    return next(new AppError('Ngày khởi hành không hợp lệ.', 400));
  }
  if (Number(dateItem.availableSlots) < participants) {
    return next(
      new AppError(`Chỉ còn ${dateItem.availableSlots} chỗ cho ngày này.`, 400)
    );
  }

  const pricing = await buildBookingFinancials({
    tour,
    participants,
    selectedServices: req.body.selectedServices,
    promotionCode: req.body.promotionCode || req.body.promoCode,
    userId: req.user.id
  });

  const platform = (
    req.body.platform ||
    req.query.platform ||
    'app'
  ).toLowerCase();
  const successUrl =
    platform === 'web'
      ? `${process.env.PUBLIC_SUCCESS_URL}?status=success&sid={CHECKOUT_SESSION_ID}`
      : `llktours://pay/success?sid={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    platform === 'web'
      ? `${process.env.PUBLIC_CANCEL_URL ||
          process.env.PUBLIC_SUCCESS_URL}?status=cancel`
      : `llktours://pay/cancel`;

  const baseLineItem = {
    price_data: {
      currency: 'vnd',
      product_data: {
        name: `Tour ${tour.name}`,
        description: tour.summary,
        images: [
          `${req.protocol}://${req.get('host')}/img/tours/${tour.imageCover}`
        ]
      },
      unit_amount: Math.round(Number(tour.price) || 0)
    },
    quantity: pricing.participants
  };

  const lineItems = [baseLineItem];

  pricing.servicesPayload.forEach(service => {
    lineItems.push({
      price_data: {
        currency: 'vnd',
        product_data: {
          name: `Dịch vụ: ${service.name}`,
          description:
            service.chargeType === 'per-person'
              ? 'Tính theo số lượng hành khách'
              : 'Tính theo số lần chọn'
        },
        unit_amount: Math.round(service.price || 0)
      },
      quantity: service.quantity
    });
  });

  let couponId = null;
  if (pricing.discountAmount > 0) {
    const coupon = await stripe.coupons.create({
      amount_off: Math.round(pricing.discountAmount),
      currency: 'vnd',
      duration: 'once',
      name: `PROMO-${pricing.promotionCode || Date.now()}`
    });
    couponId = coupon.id;
  }

  const metadata = {
    userId: `${req.user.id}`,
    tourId: `${tour.id}`,
    participants: `${pricing.participants}`,
    startDate: startKey,
    source: platform,
    services: JSON.stringify(pricing.servicesPayload),
    servicesTotal: `${pricing.servicesTotal}`,
    basePrice: `${pricing.basePrice}`,
    subtotal: `${pricing.subtotal}`,
    discountAmount: `${pricing.discountAmount}`,
    grandTotal: `${pricing.grandTotal}`,
    promotionCode: pricing.promotionCode || '',
    promotionId: pricing.promotion ? `${pricing.promotion.id}` : '',
    userPromotionId: pricing.userPromotion ? `${pricing.userPromotion.id}` : '',
    promotionName: pricing.promotion ? pricing.promotion.name : '',
    promotionType: pricing.promotion ? pricing.promotion.discountType : '',
    promotionValue: pricing.promotion
      ? `${pricing.promotion.discountValue}`
      : '',
    promotionAudience: pricing.promotion ? pricing.promotion.audience : '',
    promotionPerUserLimit: pricing.promotionPerUserLimit
      ? `${pricing.promotionPerUserLimit}`
      : ''
  };

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: req.user.email,
      client_reference_id: req.params.tourId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: lineItems,
      metadata,
      discounts: couponId ? [{ coupon: couponId }] : undefined
    });
  } catch (err) {
    console.error('Stripe create session error:', err);
    return next(new AppError(`Stripe error: ${err.message}`, 500));
  }

  res.status(200).json({ status: 'success', session });
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

// ✅ SỬA WEBHOOK - DÙNG CREATE THAY VÌ UPSERT
exports.stripeWebhook = async (req, res) => {
  console.log('[WEBHOOK] hit');
  let event;
  try {
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[WEBHOOK] verify failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('[WEBHOOK] event:', event.type);

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;

    try {
      const existing = await Booking.findOne({
        paymentMethod: 'stripe',
        providerSessionId: s.id
      });

      if (existing) {
        console.log('[WEBHOOK] booking already exists:', s.id);
        return res.json({ received: true });
      }

      // ✅ TẠO MỚI BOOKING - SẼ KÍCH HOẠT MIDDLEWARE post('save')
      const metadata = s.metadata || {};
      let servicesPayload = [];
      if (metadata.services) {
        try {
          servicesPayload = JSON.parse(metadata.services);
        } catch {
          servicesPayload = [];
        }
      }

      const services = servicesPayload
        .filter(item => item && item.quantity)
        .map(item => ({
          service: item.serviceId,
          name: item.name,
          chargeType: item.chargeType,
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 1),
          total: Number(item.total || 0)
        }));

      const parsedStartDate = metadata.startDate
        ? new Date(metadata.startDate)
        : null;

      const bookingPayload = {
        tour: metadata.tourId,
        user: metadata.userId,
        participants: Number(metadata.participants || 1),
        startDate:
          parsedStartDate && !Number.isNaN(parsedStartDate.getTime())
            ? parsedStartDate
            : new Date(),
        price: Number(metadata.grandTotal || s.amount_total || 0),
        paymentMethod: 'stripe',
        providerSessionId: s.id,
        paid: true,
        currency: (s.currency || 'vnd').toUpperCase(),
        basePrice: Number(metadata.basePrice || 0),
        services,
        servicesTotal: Number(metadata.servicesTotal || 0),
        subtotal: Number(metadata.subtotal || 0),
        discountAmount: Number(metadata.discountAmount || 0),
        promotionSnapshot: metadata.promotionCode
          ? {
              promotion: metadata.promotionId || undefined,
              userPromotion: metadata.userPromotionId || undefined,
              code: metadata.promotionCode,
              name: metadata.promotionName || '',
              discountType: metadata.promotionType || 'fixed',
              discountValue: Number(metadata.promotionValue || 0)
            }
          : undefined
      };

      const newBooking = await Booking.create(bookingPayload);

      if (metadata.promotionId || metadata.promotionCode) {
        await recordPromotionUsage({
          promotionId: metadata.promotionId,
          userPromotionId: metadata.userPromotionId,
          userId: metadata.userId,
          discountAmount: Number(metadata.discountAmount || 0),
          code: metadata.promotionCode || ''
        });
      }

      console.log('[WEBHOOK] ✅ booking created:', newBooking._id);
    } catch (e) {
      console.error('[WEBHOOK] ❌ create error:', e);
      // ✅ KIỂM TRA LỖI DUPLICATE KEY
      if (e.code === 11000) {
        console.log('[WEBHOOK] duplicate key - booking already exists');
        return res.json({ received: true });
      }
    }
  }

  return res.json({ received: true });
};

exports.getByStripeSession = catchAsync(async (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  const b = await Booking.findOne({
    paymentMethod: 'stripe',
    providerSessionId: req.params.sid
  }).populate([
    { path: 'tour', select: 'name startDates duration' },
    { path: 'user', select: 'name email' }
  ]);

  if (!b) return res.status(200).json({ status: 'pending' });
  return res.status(200).json({ status: 'success', data: b });
});

exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);

exports.checkBookingExists = catchAsync(async (req, res, next) => {
  const { tourId } = req.params;
  const startDateStr = req.body.startDate || req.query.startDate;

  if (!tourId || !startDateStr) return next();

  const startDateObj = new Date(startDateStr);

  const existingBooking = await Booking.findOne({
    tour: tourId,
    user: req.user.id,
    startDate: {
      $gte: new Date(startDateObj.setHours(0, 0, 0, 0)),
      $lt: new Date(startDateObj.setHours(23, 59, 59, 999))
    }
  });

  if (existingBooking) {
    return next(
      new AppError('Bạn đã đặt tour này cho ngày khởi hành này rồi.', 400)
    );
  }

  next();
});
