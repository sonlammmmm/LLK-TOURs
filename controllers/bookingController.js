const axios = require('axios');
const crypto = require('crypto');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Booking = require('../models/bookingModel');
const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');
const { recordPromotionUsage } = require('../utils/promotionEngine');
const { buildBookingFinancials } = require('../utils/bookingPricing');
const { formatRecentOrderCard } = require('../utils/dashboardFeed');
const {
  acquireSoftLock,
  releaseSoftLock,
  linkSessionToSoftLock,
  findActiveSoftLockBySession,
  confirmSoftLock,
  getSoftLockById,
  updateSoftLockMeta
} = require('../utils/bookingSoftLock');

const MOMO_ENDPOINT =
  process.env.MOMO_CREATE_ENDPOINT ||
  'https://test-payment.momo.vn/v2/gateway/api/create';
const MOMO_PARTNER_CODE = process.env.MOMO_PARTNER_CODE || 'MOMO';
const MOMO_ACCESS_KEY = process.env.MOMO_ACCESS_KEY || 'F8BBA842ECF85';
const MOMO_SECRET_KEY =
  process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
const MOMO_PARTNER_NAME = process.env.MOMO_PARTNER_NAME || 'LLK Tours';
const MOMO_STORE_ID = process.env.MOMO_STORE_ID || 'LLKToursStore';
const MOMO_REQUEST_TYPE = process.env.MOMO_REQUEST_TYPE || 'payWithMethod';
const MOMO_PAYMENT_CODE =
  process.env.MOMO_PAYMENT_CODE ||
  'T8Qii53fAXyUftPV3m9ysyRhEanUs9KlOPfHgpMR0ON50U10Bh+vZdpJU7VY4z+Z2y77fJHkoDc69scwwzLuW5MzeUKTwPo3ZMaB29imm6YulqnWfTkgzqRaion+EuD7FN9wZ4aXE1+mRt0gHsU193y+yxtRgpmY7SDMU9hCKoQtYyHsfFR5FUAOAKMdw2fzQqpToei3rnaYvZuYaxolprm9+/+WIETnPUDlxCYOiw7vPeaaYQQH0BF0TxyU3zu36ODx980rJvPAgtJzH1gUrlxcSS1HQeQ9ZaVM1eOK/jl8KJm6ijOwErHGbgf/hVymUQG65rHU2MWz9U8QUjvDWA==';
const MOMO_AUTO_CAPTURE =
  typeof process.env.MOMO_AUTO_CAPTURE === 'string'
    ? process.env.MOMO_AUTO_CAPTURE !== 'false'
    : true;
const MOMO_LANG = process.env.MOMO_LANG || 'vi';
const MOMO_REDIRECT_PATH =
  process.env.MOMO_REDIRECT_PATH || '/api/v1/bookings/momo/redirect';
const MOMO_IPN_PATH = process.env.MOMO_IPN_PATH || '/api/v1/bookings/momo/ipn';

const bookingSessionPopulate = [
  { path: 'tour', select: 'name startDates duration' },
  { path: 'user', select: 'name email' }
];

const releaseSoftLockSafely = async (softLockDoc, reason) => {
  if (!softLockDoc) return;
  try {
    await releaseSoftLock(softLockDoc, reason);
  } catch (err) {
    console.warn(
      `[SoftLock] Release failed (${reason || 'unknown'}):`,
      err.message
    );
  }
};

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

const buildPromotionSnapshot = metadata => {
  if (!metadata || !metadata.promotionCode) return undefined;
  const {
    promotionId,
    userPromotionId,
    promotionCode,
    promotionName,
    promotionType,
    promotionValue
  } = metadata;
  return {
    promotion: promotionId || undefined,
    userPromotion: userPromotionId || undefined,
    code: promotionCode,
    name: promotionName || '',
    discountType: promotionType || 'fixed',
    discountValue: Number(promotionValue || 0)
  };
};

const buildPromotionSnapshotFromPricing = pricing => {
  if (!pricing || !pricing.promotionCode) return undefined;
  const promoDoc = pricing.promotion || {};
  const userPromoDoc = pricing.userPromotion || {};

  return {
    promotion: promoDoc.id || promoDoc._id || undefined,
    userPromotion: userPromoDoc.id || userPromoDoc._id || undefined,
    code: pricing.promotionCode,
    name: promoDoc.name || '',
    discountType: promoDoc.discountType || 'fixed',
    discountValue: Number(promoDoc.discountValue || 0)
  };
};

const resolveHoldFromMomoPayload = async (payload, orderId) => {
  let hold = null;

  const { extraData } = payload;

  if (extraData) {
    try {
      hold = await getSoftLockById(extraData);
    } catch (err) {
      hold = null;
    }
  }

  if (!hold || hold.status !== 'active') {
    hold = await findActiveSoftLockBySession(orderId);
  }

  return hold;
};

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

  let softLockDoc = null;
  try {
    if (metadata.softLockId) {
      softLockDoc = await getSoftLockById(metadata.softLockId);
    }
    if (!softLockDoc && session.id) {
      softLockDoc = await findActiveSoftLockBySession(session.id);
    }
    if (
      softLockDoc &&
      (softLockDoc.user?.toString() !== metadata.userId ||
        softLockDoc.tour?.toString() !== metadata.tourId)
    ) {
      softLockDoc = null;
    }
  } catch (lockErr) {
    console.error('[SoftLock] Lookup error:', lockErr.message);
    softLockDoc = null;
  }

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
    promotionSnapshot: buildPromotionSnapshot(metadata),
    softLock: softLockDoc?._id
  };

  let booking;
  let created = false;

  try {
    booking = await Booking.create(bookingPayload);
    created = true;
  } catch (err) {
    if (softLockDoc && err.code !== 11000) {
      await releaseSoftLockSafely(softLockDoc, 'booking-error');
    }
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

  if (created && softLockDoc) {
    await confirmSoftLock(softLockDoc._id, booking?._id);
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

const buildServicesFromPayload = services =>
  (services || []).map(service => ({
    service: service.serviceId || service.service,
    name: service.name,
    chargeType: service.chargeType,
    price: Number(service.price || 0),
    quantity: Number(service.quantity || 1),
    total: Number(service.total || 0)
  }));

const buildSessionMetadata = (
  req,
  tour,
  pricing,
  startKey,
  platform,
  extras = {}
) => ({
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
  promotionPerUserLimit: `${pricing.promotionPerUserLimit || ''}`,
  softLockId: extras.softLockId || ''
});

const buildStripeRedirectUrls = platform =>
  platform === 'web'
    ? {
        successUrl: `${process.env.PUBLIC_SUCCESS_URL}?status=success&sid={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${process.env.PUBLIC_CANCEL_URL ||
          process.env.PUBLIC_SUCCESS_URL}?status=cancel`
      }
    : {
        successUrl: `llktours://pay/success?sid={CHECKOUT_SESSION_ID}`,
        cancelUrl: 'llktours://pay/cancel'
      };

const buildHoldBookingPayload = (req, context) => {
  const promotionSnapshot = buildPromotionSnapshotFromPricing(context.pricing);
  const promotionUsage = promotionSnapshot
    ? {
        promotionId: promotionSnapshot.promotion,
        userPromotionId: promotionSnapshot.userPromotion,
        code: promotionSnapshot.code,
        discountAmount: Number(context.pricing.discountAmount || 0)
      }
    : null;

  return {
    userId: req.user.id.toString(),
    tourId: context.tour.id.toString(),
    participants: context.participants,
    startDate: context.startDate.toISOString(),
    platform: context.platform,
    amounts: {
      basePrice: Number(context.pricing.basePrice || 0),
      servicesTotal: Number(context.pricing.servicesTotal || 0),
      subtotal: Number(context.pricing.subtotal || 0),
      discountAmount: Number(context.pricing.discountAmount || 0),
      grandTotal: Number(context.pricing.grandTotal || 0)
    },
    services: context.pricing.servicesPayload || [],
    promotionSnapshot,
    promotionUsage
  };
};

const buildMomoRedirectUrl = req =>
  process.env.MOMO_REDIRECT_URL ||
  `${req.protocol}://${req.get('host')}${MOMO_REDIRECT_PATH}`;

const buildMomoIpnUrl = req =>
  process.env.MOMO_IPN_URL ||
  `${req.protocol}://${req.get('host')}${MOMO_IPN_PATH}`;

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

const preparePaymentInitialization = async req => {
  if (!req.user?.id || !req.user?.email) {
    throw new AppError('Bạn cần đăng nhập để thanh toán.', 401);
  }

  const tour = await Tour.findById(req.params.tourId);
  if (!tour) {
    throw new AppError('Không tìm thấy tour.', 404);
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
    throw new AppError('Vui lòng chọn ngày khởi hành.', 400);
  }

  const startDate = new Date(startDateStr);
  if (Number.isNaN(startDate.getTime())) {
    throw new AppError('Ngày khởi hành không hợp lệ.', 400);
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
    throw new AppError('Ngày khởi hành không tồn tại.', 400);
  }

  const maxSlots =
    Number.parseInt(dateItem.availableSlots || '', 10) || participantsRaw;
  const participants = Math.max(Math.min(participantsRaw, maxSlots), 1);

  if (Number(dateItem.availableSlots) < participants) {
    throw new AppError(
      `Chỉ còn ${dateItem.availableSlots || 0} suất cho ngày này.`,
      400
    );
  }

  const servicesSnapshot = Array.isArray(selectedServices)
    ? selectedServices
    : [];

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

  if (!pricing || !Number.isFinite(pricing.grandTotal)) {
    throw new AppError('Không thể tính được chi phí.', 400);
  }

  let softLockRecord = null;
  try {
    const lockResult = await acquireSoftLock({
      tourId: tour.id,
      userId: req.user.id,
      startDate,
      participants,
      platform,
      servicesSnapshot
    });
    if (!lockResult?.success) {
      throw new AppError(
        lockResult?.message ||
          'Suất của lịch khởi hành này đang được giữ, vui lòng thử lại ngay sau đây.',
        409
      );
    }
    softLockRecord = lockResult.hold;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    console.error('[SoftLock] Acquire error:', err.message);
    throw new AppError(
      'Không thể giữ chỗ tạm thời cho yêu cầu này. Vui lòng thử lại sau ít phút.',
      409
    );
  }

  return {
    tour,
    startDate,
    startKey,
    participants,
    platform,
    selectedServices: servicesSnapshot,
    pricing,
    softLockRecord
  };
};

const buildMomoCreateSignature = body => {
  const rawSignature =
    `accessKey=${MOMO_ACCESS_KEY}` +
    `&amount=${body.amount}` +
    `&extraData=${body.extraData || ''}` +
    `&ipnUrl=${body.ipnUrl}` +
    `&orderId=${body.orderId}` +
    `&orderInfo=${body.orderInfo}` +
    `&partnerCode=${body.partnerCode}` +
    `&redirectUrl=${body.redirectUrl}` +
    `&requestId=${body.requestId}` +
    `&requestType=${body.requestType}`;
  return crypto
    .createHmac('sha256', MOMO_SECRET_KEY)
    .update(rawSignature)
    .digest('hex');
};

const buildMomoIpnSignature = payload => {
  const fields = [
    `accessKey=${MOMO_ACCESS_KEY}`,
    `amount=${payload.amount}`,
    `extraData=${payload.extraData || ''}`,
    `message=${payload.message || ''}`,
    `orderId=${payload.orderId}`,
    `orderInfo=${payload.orderInfo || ''}`,
    `orderType=${payload.orderType || ''}`,
    `partnerCode=${payload.partnerCode}`,
    `payType=${payload.payType || ''}`,
    `requestId=${payload.requestId}`,
    `responseTime=${payload.responseTime}`,
    `resultCode=${payload.resultCode}`,
    `transId=${payload.transId}`
  ];
  return crypto
    .createHmac('sha256', MOMO_SECRET_KEY)
    .update(fields.join('&'))
    .digest('hex');
};

const materializeBookingFromHold = async ({ hold, orderId, transId }) => {
  if (!hold) {
    throw new Error('Missing hold for MoMo transaction.');
  }

  const payload = hold.meta?.bookingPayload;

  if (!payload) {
    throw new Error('Missing booking payload stored on hold.');
  }

  const amounts = payload.amounts || {};

  const bookingDoc = {
    tour: payload.tourId,

    user: payload.userId,

    participants: Number(payload.participants || 1),

    startDate: normalizeStartDate(payload.startDate),

    price: Math.max(Number(amounts.grandTotal || 0), 0),

    paymentMethod: 'momo',

    providerSessionId: orderId,

    paid: true,

    currency: 'VND',

    basePrice: Number(amounts.basePrice || 0),

    services: buildServicesFromPayload(payload.services),

    servicesTotal: Number(amounts.servicesTotal || 0),

    subtotal: Number(amounts.subtotal || 0),

    discountAmount: Number(amounts.discountAmount || 0),

    promotionSnapshot: payload.promotionSnapshot,

    softLock: hold._id
  };

  if (transId) {
    bookingDoc.providerTransactionId = String(transId);
  }

  let booking;

  let created = false;

  try {
    booking = await Booking.create(bookingDoc);

    created = true;
  } catch (err) {
    if (err.code === 11000) {
      booking = await Booking.findOne({
        paymentMethod: 'momo',

        providerSessionId: orderId
      });
    } else {
      throw err;
    }
  }

  return { booking, created, payload };
};

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  let context;

  try {
    context = await preparePaymentInitialization(req);
  } catch (err) {
    return next(err);
  }

  const {
    tour,

    startKey,

    participants,

    platform,

    pricing,

    softLockRecord
  } = context;

  console.log('[Stripe] Checkout session request', {
    tourId: req.params.tourId,

    userId: req.user.id,

    startDate: startKey,

    participants,

    platform
  });

  console.log('[Stripe] Pricing result', {
    subtotal: pricing.subtotal,

    discount: pricing.discountAmount,

    grandTotal: pricing.grandTotal,

    services: pricing.servicesPayload.length
  });

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
      console.error('[SoftLock] Unable to attach session:', linkErr.message);
    }
  }

  console.log(`[Stripe] Session created ${session.id}`);

  console.log('[Stripe] Sending response to client...');

  res.status(200).json({ status: 'success', session });

  console.log('[Stripe] Response sent successfully');
});

const processMomoCallback = async (payloadRaw, source = 'ipn') => {
  const payload = { ...payloadRaw };

  const { orderId } = payload;

  if (!orderId) {
    throw new Error('Missing orderId');
  }

  const { signature } = payload;

  const expectedSignature = buildMomoIpnSignature(payload);

  if (!signature || signature !== expectedSignature) {
    throw new Error('Invalid signature');
  }

  const existing = await Booking.findOne({
    paymentMethod: 'momo',

    providerSessionId: orderId
  });

  if (existing) {
    return { booking: existing, created: false };
  }

  const hold = await resolveHoldFromMomoPayload(payload, orderId);

  if (!hold) {
    throw new Error('Booking hold not found');
  }

  const resultCode = Number(payload.resultCode);

  if (resultCode !== 0) {
    await releaseSoftLockSafely(hold, 'momo-payment-failed');

    return { booking: null, created: false };
  }

  let bookingResult;

  try {
    bookingResult = await materializeBookingFromHold({
      hold,

      orderId,

      transId: payload.transId
    });
  } catch (err) {
    await releaseSoftLockSafely(hold, 'momo-booking-error');

    throw err;
  }

  const { booking, created, payload: holdPayload } = bookingResult || {};

  if (!booking) {
    throw new Error('Unable to create booking');
  }

  await confirmSoftLock(hold._id, booking._id);

  const usage = holdPayload?.promotionUsage;

  if (created && usage?.promotionId) {
    await recordPromotionUsage({
      promotionId: usage.promotionId,

      userPromotionId: usage.userPromotionId,

      userId: holdPayload.userId,

      discountAmount: usage.discountAmount,

      code: usage.code
    });
  }

  console.log(`[MoMo][${source}] Booking confirmed for order ${orderId}`);

  return { booking, created };
};

exports.createMomoPayment = catchAsync(async (req, res, next) => {
  let context;
  try {
    context = await preparePaymentInitialization(req);
  } catch (err) {
    return next(err);
  }

  const { tour, pricing, platform, softLockRecord } = context;
  const amount = Math.max(Math.round(Number(pricing.grandTotal) || 0), 0);

  if (amount <= 0) {
    await releaseSoftLockSafely(softLockRecord, 'momo-invalid-amount');
    return next(new AppError('Tổng thanh toán qua MoMo phải lớn hơn 0.', 400));
  }

  const orderId = `${MOMO_PARTNER_CODE}${Date.now()}`;
  const requestId = orderId;
  const extraData = softLockRecord?.id ? softLockRecord.id.toString() : '';
  const bookingPayload = buildHoldBookingPayload(req, context);

  const requestBody = {
    partnerCode: MOMO_PARTNER_CODE,
    partnerName: MOMO_PARTNER_NAME,
    storeId: MOMO_STORE_ID,
    requestId,
    amount: String(amount),
    orderId,
    orderInfo: `Thanh toán tour ${tour.name}`,
    redirectUrl: buildMomoRedirectUrl(req),
    ipnUrl: buildMomoIpnUrl(req),
    lang: MOMO_LANG,
    requestType: MOMO_REQUEST_TYPE,
    autoCapture: MOMO_AUTO_CAPTURE,
    extraData,
    orderGroupId: ''
  };

  if (MOMO_PAYMENT_CODE) {
    requestBody.paymentCode = MOMO_PAYMENT_CODE;
  }

  requestBody.signature = buildMomoCreateSignature(requestBody);

  try {
    const response = await axios.post(MOMO_ENDPOINT, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    });
    const payload = response.data || {};
    if (payload.resultCode !== 0 || !payload.payUrl) {
      throw new AppError(payload.message || 'MoMo từ chối tạo giao dịch.', 400);
    }

    if (softLockRecord) {
      await linkSessionToSoftLock(softLockRecord.id, orderId);
      try {
        await updateSoftLockMeta(softLockRecord.id, {
          bookingPayload,
          momo: {
            orderId,
            requestId,
            amount,
            platform
          }
        });
      } catch (metaErr) {
        console.warn(
          '[MoMo] Unable to persist booking payload:',
          metaErr.message
        );
      }
    }

    return res.status(200).json({
      status: 'success',
      data: {
        orderId,
        requestId,
        payUrl: payload.payUrl,
        deeplink: payload.deeplink,
        qrCodeUrl: payload.qrCodeUrl,
        resultCode: payload.resultCode,
        message: payload.message
      }
    });
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
});

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

exports.createBookingCheckout = catchAsync(async (req, res, next) => {
  const { tour, user, price, participants, startDate } = req.query;

  if (!tour || !user || !price || !startDate) return next();

  if (!req.user || req.user.id.toString() !== user.toString()) {
    return next(
      new AppError('Bạn không được phép xác nhận booking cho người khác.', 403)
    );
  }

  const normalizedPrice = Number(price);
  if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) {
    return next(new AppError('Giá booking không hợp lệ.', 400));
  }

  const normalizedParticipants =
    Number.parseInt(participants, 10) > 0
      ? Number.parseInt(participants, 10)
      : 1;

  const parsedStartDate = new Date(startDate);
  if (Number.isNaN(parsedStartDate.getTime())) {
    return next(new AppError('Ngày khởi hành không hợp lệ.', 400));
  }

  const newBooking = await Booking.create({
    tour,
    user,
    price: normalizedPrice,
    participants: normalizedParticipants,
    startDate: parsedStartDate
  });

  return res.redirect(`/booking-success?booking=${newBooking._id}`);
});

exports.createBooking = factory.createOne(Booking);
exports.getBooking = factory.getOne(Booking);
exports.getAllBookings = factory.getAll(Booking);

exports.getRecentBookingFeed = catchAsync(async (req, res) => {
  const limitRaw = parseInt(req.query.limit, 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 15)
    : 6;

  const bookings = await Booking.find()
    .sort('-createdAt')
    .limit(limit)
    .lean();

  const orders = bookings
    .map(formatRecentOrderCard)
    .filter(Boolean);

  res.status(200).json({
    status: 'success',
    results: orders.length,
    data: { orders }
  });
});

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
