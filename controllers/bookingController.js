const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1) Lấy tour
  const tour = await Tour.findById(req.params.tourId);
  if (!tour) return next(new AppError('Không tìm thấy tour này.', 404));

  // 2) Lấy tham số đầu vào
  const participants = Number.parseInt(req.query.participants, 10) || 1;
  const startDateStr = req.query.startDate;

  if (participants < 1) {
    return next(
      new AppError('Số lượng người tham gia tối thiểu là 1 người.', 400)
    );
  }
  if (tour.maxGroupSize && participants > tour.maxGroupSize) {
    return next(
      new AppError(
        `Số lượng người tham gia tối đa là ${tour.maxGroupSize} người.`,
        400
      )
    );
  }

  // 3) Xác định ngày khởi hành
  let startDate;
  if (!startDateStr) {
    // Không có startDate -> chọn ngày sớm nhất còn slot
    const firstAvailable = (tour.startDates || []).find(
      d => Number(d.availableSlots) > 0
    );
    if (!firstAvailable) {
      return next(
        new AppError('Hiện tour này không còn ngày khởi hành trống.', 400)
      );
    }
    startDate = new Date(firstAvailable.date);
  } else {
    startDate = new Date(startDateStr);
    if (Number.isNaN(startDate.getTime())) {
      return next(new AppError('startDate không hợp lệ.', 400));
    }
  }

  // 4) Tìm đúng object ngày theo YYYY-MM-DD
  const startKey = startDate.toISOString().split('T')[0];
  const dateItem = (tour.startDates || []).find(
    d => new Date(d.date).toISOString().split('T')[0] === startKey
  );
  if (!dateItem) {
    return next(new AppError('Ngày khởi hành không hợp lệ.', 400));
  }

  // 5) ✅ CHẶN OVERBOOK THEO NGÀY
  const daySlots = Number(dateItem.availableSlots);
  if (Number.isFinite(daySlots) && participants > daySlots) {
    return next(new AppError(`Chỉ còn ${daySlots} chỗ cho ngày này.`, 400));
  }

  // 6) Tính tổng tiền (Stripe với VND là zero-decimal -> dùng số nguyên)
  const unitAmount = Math.round(Number(tour.price) || 0); // giá mỗi người
  const totalPrice = unitAmount * participants;

  // Giới hạn an toàn tuỳ logic của bạn
  if (totalPrice > 99_999_999) {
    return next(
      new AppError(
        'Tổng số tiền thanh toán vượt quá giới hạn của Stripe (₫99,999,999).',
        400
      )
    );
  }

  // 7) Tạo Checkout Session (giữ nguyên cấu trúc API của bạn)
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    success_url: `${req.protocol}://${req.get('host')}/booking-success?tour=${
      req.params.tourId
    }&user=${
      req.user.id
    }&price=${totalPrice}&participants=${participants}&startDate=${startDate.toISOString()}`,
    cancel_url: `${req.protocol}://${req.get('host')}/tour/${tour.slug}`,
    customer_email: req.user.email,
    client_reference_id: req.params.tourId,
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
    mode: 'payment'
  });

  // 8) Trả về client
  res.status(200).json({
    status: 'success',
    session
  });
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
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);

// Kiểm tra xem người dùng đã đặt tour cho ngày cụ thể chưa
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
