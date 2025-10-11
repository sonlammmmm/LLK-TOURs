/* eslint-disable prettier/prettier */
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1) Lấy thông tin tour hiện tại
  const tour = await Tour.findById(req.params.tourId);
  if (!tour) {
    return next(new AppError('Không tìm thấy tour này.', 404));
  }

  // 2) Lấy thông tin ngày khởi hành và số người tham gia
  const startDateStr = req.query.startDate;

  // ⚙️ Nếu không có startDate, thay vì báo lỗi thì chọn ngày sớm nhất có slot
  let startDate = null;
  if (!startDateStr) {
    const availableDate = (tour.startDates || []).find(
      d => d.availableSlots > 0
    );
    if (availableDate) {
      startDate = new Date(availableDate.date);
      console.log("⚠️ Không có startDate từ client — tự động chọn ngày:", startDate);
    } else {
      // Nếu không còn ngày nào khả dụng
      return next(new AppError('Hiện tour này không còn ngày khởi hành trống.', 400));
    }
  } else {
    startDate = new Date(startDateStr);
  }

  // Kiểm tra xem ngày khởi hành có hợp lệ không
  const isValidStartDate = tour.startDates.some(
    obj =>
      new Date(obj.date).toISOString().split('T')[0] ===
      startDate.toISOString().split('T')[0]
  );

  if (!isValidStartDate) {
    return next(new AppError('Ngày khởi hành không hợp lệ.', 400));
  }

  // Lấy số lượng người tham gia từ query (mặc định 1 nếu không có)
  const participants = Number.parseInt(req.query.participants, 10) || 1;

  // Kiểm tra ràng buộc số lượng người tham gia (nằm trong maxGroupSize)
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

  // Tính tổng giá
  const totalPrice = tour.price * participants;

  // Kiểm tra tổng giá không vượt quá giới hạn của Stripe (₫99,999,999)
  if (totalPrice > 99999999) {
    return next(
      new AppError(
        'Tổng số tiền thanh toán vượt quá giới hạn của Stripe (₫99,999,999).',
        400
      )
    );
  }

  // 3) Tạo Checkout Session với cấu trúc API của Stripe
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    // URL thành công để chuyển hướng đến trang booking-success
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
              `${req.protocol}://${req.get('host')}/img/tours/${tour.imageCover}`
            ]
          },
          unit_amount: tour.price
        },
        quantity: participants
      }
    ],
    mode: 'payment'
  });

  // 4) Gửi về client
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
