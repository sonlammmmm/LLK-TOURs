const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const Service = require('../models/serviceModel');
const Promotion = require('../models/promotionModel');
const UserPromotion = require('../models/userPromotionModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Review = require('../models/reviewModel');

const formatStartDatesWithSlots = tour => {
  if (!tour.startDates) return [];

  const now = new Date();
  return tour.startDates
    .filter(dateObj => new Date(dateObj.date) > now)
    .map(dateObj => ({
      date: dateObj.date,
      dateFormatted: new Date(dateObj.date).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }),
      availableSlots: dateObj.availableSlots,
      isFull: dateObj.availableSlots === 0,
      isAlmostFull:
        dateObj.availableSlots > 0 &&
        dateObj.availableSlots <= tour.maxGroupSize * 0.2
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

exports.alerts = (req, res, next) => {
  const { alert } = req.query;
  if (alert === 'booking')
    res.locals.alert =
      'Đặt tour của bạn đã thành công! Vui lòng kiểm tra email để xác nhận. Nếu đặt chỗ của bạn không hiển thị ở đây ngay lập tức, vui lòng quay lại sau.';
  next();
};

exports.getOverview = catchAsync(async (req, res, next) => {
  const tours = await Tour.find().lean();
  const uniqueLocations = await Tour.distinct('startLocation.description');

  res.status(200).render('overview', {
    title: 'Tất cả chuyến đi',
    tours,
    uniqueLocations,
    noResults: tours.length === 0
  });
});

exports.searchTours = catchAsync(async (req, res, next) => {
  const { name, startDates, startLocation } = req.query;

  const searchQuery = {};

  if (name) {
    searchQuery.$or = [
      { name: { $regex: name, $options: 'i' } },
      { 'startLocation.description': { $regex: name, $options: 'i' } },
      { 'startLocation.address': { $regex: name, $options: 'i' } }
    ];
  }

  if (startDates) {
    const searchDate = new Date(startDates);
    searchQuery.startDates = {
      $gte: searchDate,
      $lt: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000)
    };
  }

  if (startLocation) {
    searchQuery['startLocation.description'] = {
      $regex: startLocation,
      $options: 'i'
    };
  }

  const tours = await Tour.find(searchQuery);
  const uniqueLocations = await Tour.distinct('startLocation.description');

  res.status(200).render('overview', {
    title: 'Kết quả tìm kiếm',
    tours,
    uniqueLocations,
    searchParams: req.query,
    noResults: tours.length === 0
  });
});

// ✅ CẬP NHẬT: Thêm thông tin slot
exports.getTour = catchAsync(async (req, res, next) => {
  const tour = await Tour.findOne({ slug: req.params.slug }).populate({
    path: 'reviews',
    fields: 'review rating user'
  });

  if (!tour) {
    return next(new AppError('Không tìm thấy dữ liệu nào', 404));
  }

  // Format ngày khởi hành với thông tin slot
  const startDatesWithSlots = formatStartDatesWithSlots(tour);

  res.status(200).render('tour', {
    title: `${tour.name}`,
    tour,
    startDatesWithSlots // ✅ Truyền biến này vào view
  });
});

exports.getLoginForm = (req, res) => {
  res.status(200).render('login', {
    title: 'Đăng nhập'
  });
};

exports.getSignupForm = (req, res) => {
  res.status(200).render('signup', {
    title: 'Đăng ký'
  });
};

exports.getAccount = (req, res) => {
  res.status(200).render('account', {
    title: 'Tài khoản của bạn'
  });
};

exports.getMyTours = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find({ user: req.user.id });
  const reviews = await Review.find({ user: req.user.id }).populate({
    path: 'tour',
    select: 'name'
  });
  const reviewsMap = reviews.reduce((acc, review) => {
    if (review.tour) acc[review.tour.id] = review;
    return acc;
  }, {});

  const today = new Date();

  const enrichedBookings = bookings
    .map(booking => {
      const { tour } = booking;
      if (!tour) return null;
      const startDate = booking.startDate ? new Date(booking.startDate) : null;
      const fallbackDate =
        tour.startDates && tour.startDates.length
          ? new Date(tour.startDates[0])
          : null;
      const displayDate = startDate || fallbackDate;
      let endDate = null;
      if (displayDate) {
        endDate = new Date(displayDate);
        endDate.setDate(endDate.getDate() + (tour.duration || 0));
      }
      let statusText = 'Lịch trình cập nhật';
      if (displayDate) {
        if (endDate && today > endDate) {
          statusText = 'Đã hoàn thành';
        } else if (displayDate > today) {
          statusText = 'Sắp khởi hành';
        } else {
          statusText = 'Đang diễn ra';
        }
      }
      const tourId = tour.id ? tour.id : tour._id ? tour._id.toString() : null;
      const userReview = tourId ? reviewsMap[tourId] : null;
      const hasReviewed = userReview !== null && userReview !== undefined; // Check if userReview is not null or undefined
      const canReview = endDate ? today > endDate : false;
      const pendingReview = canReview && !hasReviewed;
      const dateLabel = displayDate
        ? displayDate.toLocaleDateString('vi-VN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })
        : 'Chưa xác định';
      const paidAmount = booking.price ? Number(booking.price) : 0;
      const paidAmountLabel = paidAmount.toLocaleString('vi-VN');
      const bookingCode = booking.id ? booking.id.slice(-6).toUpperCase() : '';
      const ratingAverage =
        typeof tour.ratingsAverage === 'number' ? tour.ratingsAverage : 0;
      const ratingsQuantity =
        typeof tour.ratingsQuantity === 'number' ? tour.ratingsQuantity : 0;

      return {
        booking,
        tour,
        displayDate,
        dateLabel,
        statusText,
        canReview,
        hasReviewed,
        userReview,
        pendingReview,
        paidAmount,
        paidAmountLabel,
        bookingCode,
        ratingAverage,
        ratingsQuantity,
        endDate
      };
    })
    .filter(Boolean);

  const sortedBookings = [...enrichedBookings].sort((a, b) => {
    const aTime = a.displayDate ? a.displayDate.getTime() : 0;
    const bTime = b.displayDate ? b.displayDate.getTime() : 0;
    return bTime - aTime;
  });

  const upcomingCount = sortedBookings.filter(
    entry => entry.displayDate && entry.displayDate > today
  ).length;
  const completedCount = sortedBookings.filter(
    entry => entry.endDate && today > entry.endDate
  ).length;
  const totalSpent = sortedBookings.reduce(
    (sum, entry) => sum + entry.paidAmount,
    0
  );
  const formattedSpend = totalSpent.toLocaleString('vi-VN');
  const pendingReviewCount = sortedBookings.filter(entry => entry.pendingReview)
    .length;

  const summaryStats = [
    {
      label: 'Tour đã đặt',
      value: sortedBookings.length,
      detail: 'Lịch trình đang theo dõi'
    },
    {
      label: 'Sắp khởi hành',
      value: upcomingCount,
      detail: 'Chuẩn bị hành lý'
    },
    { label: 'Đã hoàn thành', value: completedCount, detail: 'Kỷ niệm đã lưu' },
    {
      label: 'Tổng chi',
      value: `${formattedSpend} VNĐ`,
      detail: 'Đã thanh toán'
    }
  ];

  res.status(200).render('myTours', {
    title: 'Tour của bạn',
    bookings,
    reviews,
    sortedBookings,
    summaryStats,
    pendingReviewCount
  });
});

exports.updateUserData = catchAsync(async (req, res, next) => {
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    {
      name: req.body.name,
      email: req.body.email
    },
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).render('account', {
    title: 'Tài khoản của bạn',
    user: updatedUser
  });
});

exports.getManageTours = catchAsync(async (req, res, next) => {
  const toursRaw = await Tour.find();
  const now = new Date();

  const bookingStats = await Booking.aggregate([
    {
      $match: {
        startDate: { $gt: now }
      }
    },
    {
      $group: {
        _id: {
          tour: '$tour',
          startDate: {
            $dateToString: { format: '%Y-%m-%d', date: '$startDate' }
          }
        },
        bookedSeats: { $sum: '$participants' }
      }
    }
  ]);

  const bookingMap = bookingStats.reduce((acc, stat) => {
    const tourId = stat._id.tour.toString();
    const dateKey = stat._id.startDate;
    if (!acc[tourId]) acc[tourId] = {};
    acc[tourId][dateKey] = stat.bookedSeats;
    return acc;
  }, {});

  const tours = toursRaw.map(tour => {
    const tourObj = tour.toObject();
    const tourId = tourObj._id.toString();
    const activeStartDates = (tourObj.startDates || [])
      .filter(
        dateObj =>
          dateObj &&
          dateObj.date &&
          new Date(dateObj.date).toString() !== 'Invalid Date' &&
          new Date(dateObj.date) > now
      )
      .map(dateObj => {
        const dateValue = new Date(dateObj.date);
        const dateKey = dateValue.toISOString().split('T')[0];
        const availableSlots =
          typeof dateObj.availableSlots === 'number'
            ? dateObj.availableSlots
            : tourObj.maxGroupSize;
        const bookedSeats =
          bookingMap[tourId] && bookingMap[tourId][dateKey] != null
            ? bookingMap[tourId][dateKey]
            : Math.max(0, tourObj.maxGroupSize - availableSlots);

        return {
          date: dateValue,
          dateFormatted: dateValue.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }),
          availableSlots,
          bookedSeats,
          capacity: tourObj.maxGroupSize
        };
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    tourObj.activeStartDates = activeStartDates;
    return tourObj;
  });

  const totalUpcomingDepartures = tours.reduce(
    (sum, tour) => sum + tour.activeStartDates.length,
    0
  );
  const totalFutureBookings = bookingStats.reduce(
    (sum, stat) => sum + (stat.bookedSeats || 0),
    0
  );

  res.status(200).render('manageTours', {
    title: 'Quản lý tour',
    tours,
    adminMenuActive: 'tours',
    totalUpcomingDepartures,
    totalFutureBookings
  });
});

exports.getNewTourForm = catchAsync(async (req, res, next) => {
  const guides = await User.find({
    role: { $in: ['guide', 'lead-guide'] }
  }).select('+active');

  res.status(200).render('tourForm', {
    title: 'Tạo tour mới',
    adminMenuActive: 'tours',
    guides
  });
});

exports.getEditTourForm = catchAsync(async (req, res, next) => {
  const tour = await Tour.findById(req.params.id).populate('guides');

  if (!tour) {
    return next(new AppError('Không tìm thấy tour với ID này', 404));
  }

  const guides = await User.find({
    role: { $in: ['guide', 'lead-guide'] }
  }).select('+active');

  res.status(200).render('tourForm', {
    title: `Chỉnh sửa tour: ${tour.name}`,
    tour,
    guides,
    adminMenuActive: 'tours'
  });
});

exports.getManageUsers = catchAsync(async (req, res, next) => {
  const query = User.find().select('+active');
  query._adminRoute = true;
  const users = await query;

  res.status(200).render('manageUsers', {
    title: 'Quản lý Người dùng',
    users,
    adminMenuActive: 'users'
  });
});

exports.getNewUserForm = catchAsync(async (req, res, next) => {
  res.status(200).render('userForm', {
    title: 'Tạo người dùng mới',
    user: null,
    adminMenuActive: 'users'
  });
});

exports.getEditUserForm = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('+active');

  if (!user) {
    return next(new AppError('Không tìm thấy người dùng với ID này', 404));
  }

  res.status(200).render('userForm', {
    title: `Chỉnh sửa người dùng: ${user.name}`,
    user,
    adminMenuActive: 'users'
  });
});

exports.getManageBookings = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find();

  res.status(200).render('manageBookings', {
    title: 'Lịch sử đặt tour',
    bookings,
    adminMenuActive: 'bookings'
  });
});

exports.getManageServices = catchAsync(async (req, res, next) => {
  const services = await Service.find().sort({
    status: 1,
    displayOrder: 1,
    name: 1
  });

  res.status(200).render('manageServices', {
    title: 'Quản lý dịch vụ',
    services,
    adminMenuActive: 'services'
  });
});

exports.getServiceForm = catchAsync(async (req, res, next) => {
  let service = null;

  if (req.params.id) {
    service = await Service.findById(req.params.id);
    if (!service) {
      return next(new AppError('Không tìm thấy dịch vụ', 404));
    }
  }

  res.status(200).render('serviceForm', {
    title: service ? `Chỉnh sửa dịch vụ: ${service.name}` : 'Tạo dịch vụ mới',
    service,
    adminMenuActive: 'services'
  });
});

exports.getManagePromotions = catchAsync(async (req, res, next) => {
  const promotions = await Promotion.find().sort('-createdAt');

  res.status(200).render('managePromotions', {
    title: 'Quản lý khuyến mãi',
    promotions,
    adminMenuActive: 'promotions'
  });
});

exports.getPromotionForm = catchAsync(async (req, res, next) => {
  let promotion = null;

  if (req.params.id) {
    promotion = await Promotion.findById(req.params.id);
    if (!promotion) {
      return next(new AppError('Không tìm thấy khuyến mãi', 404));
    }
  }

  res.status(200).render('promotionForm', {
    title: promotion
      ? `Chỉnh sửa khuyến mãi: ${promotion.name}`
      : 'Tạo khuyến mãi mới',
    promotion,
    adminMenuActive: 'promotions'
  });
});

exports.getPromotionAssignForm = catchAsync(async (req, res, next) => {
  const promotion = await Promotion.findById(req.params.id);
  if (!promotion) {
    return next(new AppError('Không tìm thấy khuyến mãi', 404));
  }

  const users = await User.find()
    .select('name email role')
    .sort('name');

  res.status(200).render('promotionAssignForm', {
    title: `Gắn mã cho user - ${promotion.name}`,
    promotion,
    users,
    adminMenuActive: 'promotions'
  });
});

exports.getMyPromotionsView = catchAsync(async (req, res, next) => {
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

  const promos = assignments.filter(item => item.promotion);

  res.status(200).render('myPromotions', {
    title: 'Mã khuyến mãi của tôi',
    promotions: promos
  });
});
exports.getBookingDetail = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(new AppError('Không tìm thấy đặt tour với ID này', 404));
  }

  res.status(200).render('bookingDetail', {
    title: `Chi tiết đặt tour: ${booking.tour.name}`,
    booking,
    adminMenuActive: 'bookings'
  });
});

exports.getBookingForm = catchAsync(async (req, res, next) => {
  const tour = await Tour.findById(req.params.tourId);

  if (!tour) {
    return next(new AppError('Không tìm thấy tour với ID này', 404));
  }

  const startDatesWithSlots = formatStartDatesWithSlots(tour);

  const services = await Service.find({
    status: 'active',
    visibility: 'public'
  }).sort({ displayOrder: 1, name: 1 });

  let userPromotions = [];
  if (req.user) {
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

    userPromotions = assignments
      .filter(item => item.promotion)
      .map(item => ({
        id: item.id,
        code: item.code || item.promotion.code,
        name: item.promotion.name,
        description: item.promotion.description,
        discountType: item.promotion.discountType,
        discountValue: item.promotion.discountValue,
        maxDiscountAmount: item.promotion.maxDiscountAmount,
        minOrderAmount: item.promotion.minOrderAmount,
        expiresAt: item.expiresAt || item.promotion.endDate,
        usageLimit: item.usageLimit,
        usageCount: item.usageCount
      }));
  }

  res.status(200).render('bookingForm', {
    title: `Đặt tour: ${tour.name}`,
    tour,
    startDatesWithSlots,
    services,
    userPromotions
  });
});

exports.getBookingSuccess = catchAsync(async (req, res, next) => {
  const { booking: bookingId, sid } = req.query;

  let booking = null;
  if (bookingId) {
    booking = await Booking.findById(bookingId).populate('tour user');
  } else if (sid) {
    booking = await Booking.findOne({
      paymentMethod: 'stripe',
      providerSessionId: sid
    }).populate('tour user');
  }

  const pending = !booking;

  return res.status(200).render('bookingSuccess', {
    title: pending ? 'Đang xác nhận thanh toán' : 'Thanh toán thành công',
    booking,
    pending,
    sid: sid || null // dùng cho client poll
  });
});

exports.getManageReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.find()
    .populate({
      path: 'user',
      select: 'name photo'
    })
    .populate({
      path: 'tour',
      select: 'name'
    });

  res.status(200).render('manageReviews', {
    title: 'Quản lý đánh giá',
    reviews,
    adminMenuActive: 'reviews'
  });
});

exports.getBookingInvoice = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(new AppError('Không tìm thấy đặt tour với ID này', 404));
  }

  if (booking.user.id !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('Bạn không có quyền xem hóa đơn này', 403));
  }

  await booking.populate([
    { path: 'tour', select: 'name startDates duration' },
    { path: 'user', select: 'name email' }
  ]);

  res.status(200).render('bookingInvoice', {
    title: `Hóa đơn: ${booking.tour.name}`,
    booking
  });
});

exports.getMyBilling = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find({ user: req.user.id }).populate({
    path: 'tour',
    select: 'name'
  });

  res.status(200).render('myBilling', {
    title: 'Hóa đơn của tôi',
    bookings
  });
});

exports.getMyReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.find({ user: req.user.id }).populate({
    path: 'tour',
    select: 'name imageCover slug'
  });

  res.status(200).render('myReviews', {
    title: 'Đánh giá của tôi',
    reviews
  });
});

exports.getForgotPasswordForm = (req, res) => {
  res.status(200).render('forgotPassword', {
    title: 'Quên mật khẩu'
  });
};

exports.getResetPasswordForm = (req, res) => {
  res.status(200).render('resetPassword', {
    title: 'Đặt lại mật khẩu',
    token: req.params.token
  });
};

exports.getDashboard = catchAsync(async (req, res, next) => {
  const [
    totalTours,
    totalBookings,
    totalUsers,
    totalReviews,
    paidBookings,
    unpaidBookings
  ] = await Promise.all([
    Tour.countDocuments(),
    Booking.countDocuments(),
    User.countDocuments(),
    Review.countDocuments(),
    Booking.countDocuments({ paid: true }),
    Booking.countDocuments({ paid: false })
  ]);

  const availableYearsAggregation = await Booking.aggregate([
    {
      $group: {
        _id: { $year: '$createdAt' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  let availableYears = availableYearsAggregation.map(item => item._id);
  if (availableYears.length === 0) {
    availableYears = [new Date().getFullYear()];
  }

  let selectedYear = parseInt(req.query.year, 10);
  if (!selectedYear || !availableYears.includes(selectedYear)) {
    selectedYear = availableYears[availableYears.length - 1];
  }

  const startDate = new Date(selectedYear, 0, 1);
  const endDate = new Date(selectedYear + 1, 0, 1);

  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const todayEnd = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 1
  );

  const todayRevenue = await Booking.aggregate([
    {
      $match: {
        paid: true,
        createdAt: { $gte: todayStart, $lt: todayEnd }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$price' }
      }
    }
  ]);

  const formattedDate = `${today.getDate()}/${today.getMonth() +
    1}/${today.getFullYear()}`;

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const monthRevenue = await Booking.aggregate([
    {
      $match: {
        paid: true,
        createdAt: {
          $gte: monthStart,
          $lt: new Date(monthEnd.getTime() + 86400000)
        }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$price' }
      }
    }
  ]);

  const formattedMonth = `${today.getMonth() + 1}/${today.getFullYear()}`;

  const yearStart = new Date(today.getFullYear(), 0, 1);
  const yearEnd = new Date(today.getFullYear() + 1, 0, 1);

  const yearRevenue = await Booking.aggregate([
    {
      $match: {
        paid: true,
        createdAt: { $gte: yearStart, $lt: yearEnd }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$price' }
      }
    }
  ]);

  const revenueAggregation = await Booking.aggregate([
    {
      $match: {
        paid: true,
        createdAt: { $gte: startDate, $lt: endDate }
      }
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        totalRevenue: { $sum: '$price' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const months = [
    'Tháng 1',
    'Tháng 2',
    'Tháng 3',
    'Tháng 4',
    'Tháng 5',
    'Tháng 6',
    'Tháng 7',
    'Tháng 8',
    'Tháng 9',
    'Tháng 10',
    'Tháng 11',
    'Tháng 12'
  ];

  const formattedRevenueData = months.map(month => ({ month, revenue: 0 }));
  revenueAggregation.forEach(item => {
    const monthIndex = item._id - 1;
    formattedRevenueData[monthIndex].revenue = item.totalRevenue;
  });

  const dailyRevenueByMonth = months.map((monthName, monthIndex) => {
    const daysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, dayIndex) => ({
      day: `Ngày ${dayIndex + 1}`,
      revenue: 0
    }));
    return { month: monthName, days };
  });

  const dailyRevenueAggregation = await Booking.aggregate([
    {
      $match: {
        paid: true,
        createdAt: { $gte: startDate, $lt: endDate }
      }
    },
    {
      $group: {
        _id: {
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        totalRevenue: { $sum: '$price' }
      }
    },
    { $sort: { '_id.month': 1, '_id.day': 1 } }
  ]);

  dailyRevenueAggregation.forEach(item => {
    const monthIndex = item._id.month - 1;
    const dayIndex = item._id.day - 1;
    if (
      dailyRevenueByMonth[monthIndex] &&
      dailyRevenueByMonth[monthIndex].days[dayIndex]
    ) {
      dailyRevenueByMonth[monthIndex].days[dayIndex].revenue =
        item.totalRevenue;
    }
  });

  res.status(200).render('dashboard', {
    title: 'Bảng điều khiển quản lý',
    stats: {
      totalTours,
      totalBookings,
      totalUsers,
      totalReviews,
      paidBookings,
      unpaidBookings
    },
    revenueData: formattedRevenueData,
    dailyRevenueByMonth,
    selectedYear,
    availableYears,
    todayRevenue: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
    monthRevenue: monthRevenue.length > 0 ? monthRevenue[0].total : 0,
    yearRevenue: yearRevenue.length > 0 ? yearRevenue[0].total : 0,
    formattedDate,
    formattedMonth,
    currentYear: today.getFullYear(),
    adminMenuActive: 'dashboard'
  });
});
