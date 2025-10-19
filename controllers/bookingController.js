const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  if (!req.user || !req.user.id || !req.user.email) {
    return next(new AppError('Bạn cần đăng nhập trước khi thanh toán.', 401));
  }

  const tour = await Tour.findById(req.params.tourId);
  if (!tour) return next(new AppError('Không tìm thấy tour này.', 404));

  const participants = Number.parseInt(req.query.participants, 10) || 1;
  const startDateStr = req.query.startDate;
  if (participants < 1)
    return next(new AppError('Số người tối thiểu là 1.', 400));

  let startDate = startDateStr ? new Date(startDateStr) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) {
    const firstAvailable = (tour.startDates || []).find(
      d => Number(d.availableSlots) > 0
    );
    if (!firstAvailable)
      return next(new AppError('Không còn ngày khởi hành trống.', 400));
    startDate = new Date(firstAvailable.date);
  }

  const startKey = startDate.toISOString().split('T')[0];
  const dateItem = (tour.startDates || []).find(
    d => new Date(d.date).toISOString().split('T')[0] === startKey
  );
  if (!dateItem) return next(new AppError('Ngày khởi hành không hợp lệ.', 400));
  if (Number(dateItem.availableSlots) < participants) {
    return next(new AppError(`Chỉ còn ${dateItem.availableSlots} chỗ.`, 400));
  }

  const unitAmount = Math.round(Number(tour.price) || 0);

  const platform = (req.query.platform || 'app').toLowerCase();
  const successUrl =
    platform === 'web'
      ? `${process.env.PUBLIC_SUCCESS_URL}?status=success&sid={CHECKOUT_SESSION_ID}`
      : `llktours://pay/success?sid={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    platform === 'web'
      ? `${process.env.PUBLIC_CANCEL_URL ||
          process.env.PUBLIC_SUCCESS_URL}?status=cancel`
      : `llktours://pay/cancel`;

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: req.user.email,
      client_reference_id: req.params.tourId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: [
        {
          price_data: {
            currency: 'vnd',
            product_data: {
              name: `Tour ${tour.name}`,
              description: tour.summary,
              images: [
                `${req.protocol}://${req.get('host')}/img/tours/${
                  tour.imageCover
                }`
              ]
            },
            unit_amount: unitAmount
          },
          quantity: participants
        }
      ],
      metadata: {
        userId: `${req.user.id}`,
        tourId: `${tour.id}`,
        participants: `${participants}`,
        startDate: startKey,
        source: platform
      }
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
      const newBooking = await Booking.create({
        tour: s.metadata?.tourId,
        user: s.metadata?.userId,
        participants: Number(s.metadata?.participants || 1),
        startDate: new Date(s.metadata?.startDate),
        price: Number(s.amount_total || 0),
        paymentMethod: 'stripe',
        providerSessionId: s.id,
        paid: true
      });

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
  const startDateStr = req.query.startDate;

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
