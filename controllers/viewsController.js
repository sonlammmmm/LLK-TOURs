const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Review = require('../models/reviewModel');

const formatStartDatesWithSlots = tour => {
  if (!tour.startDates) return [];

  const now = new Date();
  return tour.startDates
    .filter(dateObj => new Date(dateObj.date) > now) // Chỉ lấy ngày tương lai
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
  const tourIDs = bookings.map(el => el.tour);
  const tours = await Tour.find({ _id: { $in: tourIDs } });
  const reviews = await Review.find({ user: req.user.id }).populate({
    path: 'tour',
    select: 'name'
  });

  res.status(200).render('myTours', {
    title: 'Tour của tôi',
    tours,
    bookings,
    reviews
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
  const tours = await Tour.find();

  res.status(200).render('manageTours', {
    title: 'Quản lý tour',
    tours
  });
});

exports.getNewTourForm = catchAsync(async (req, res, next) => {
  const guides = await User.find({
    role: { $in: ['guide', 'lead-guide'] }
  }).select('+active');

  res.status(200).render('tourForm', {
    title: 'Tạo tour mới',
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
    guides
  });
});

exports.getManageUsers = catchAsync(async (req, res, next) => {
  const query = User.find().select('+active');
  query._adminRoute = true;
  const users = await query;

  res.status(200).render('manageUsers', {
    title: 'Quản lý Người dùng',
    users
  });
});

exports.getNewUserForm = catchAsync(async (req, res, next) => {
  res.status(200).render('userForm', {
    title: 'Tạo người dùng mới',
    user: null
  });
});

exports.getEditUserForm = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('+active');

  if (!user) {
    return next(new AppError('Không tìm thấy người dùng với ID này', 404));
  }

  res.status(200).render('userForm', {
    title: `Chỉnh sửa người dùng: ${user.name}`,
    user
  });
});

exports.getManageBookings = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find();

  res.status(200).render('manageBookings', {
    title: 'Lịch sử đặt tour',
    bookings
  });
});

exports.getBookingDetail = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(new AppError('Không tìm thấy đặt tour với ID này', 404));
  }

  res.status(200).render('bookingDetail', {
    title: `Chi tiết đặt tour: ${booking.tour.name}`,
    booking
  });
});

// ✅ CẬP NHẬT: Thêm thông tin slot
exports.getBookingForm = catchAsync(async (req, res, next) => {
  const tour = await Tour.findById(req.params.tourId);

  if (!tour) {
    return next(new AppError('Không tìm thấy tour với ID này', 404));
  }

  // Format ngày khởi hành với thông tin slot
  const startDatesWithSlots = formatStartDatesWithSlots(tour);

  res.status(200).render('bookingForm', {
    title: `Đặt tour: ${tour.name}`,
    tour,
    startDatesWithSlots // ✅ Truyền biến này vào view
  });
});

exports.getBookingSuccess = catchAsync(async (req, res, next) => {
  const {
    booking: bookingId,
    tour,
    user,
    price,
    participants,
    startDate
  } = req.query;

  let booking;

  if (bookingId) {
    booking = await Booking.findById(bookingId);

    if (!booking) {
      return next(new AppError('Không tìm thấy thông tin đặt tour', 404));
    }
  } else if (tour && user && price) {
    booking = await Booking.create({
      tour,
      user,
      price,
      participants: participants || 1,
      startDate: startDate ? new Date(startDate) : new Date()
    });
  } else {
    return next(new AppError('Không tìm thấy thông tin đặt tour', 404));
  }

  await booking.populate([
    { path: 'tour', select: 'name startDates duration' },
    { path: 'user', select: 'name email' }
  ]);

  res.status(200).render('bookingSuccess', {
    title: 'Thanh toán thành công',
    booking
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
    reviews
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
    currentYear: today.getFullYear()
  });
});
