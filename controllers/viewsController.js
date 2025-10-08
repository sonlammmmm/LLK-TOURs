const Tour = require('../models/tourModel');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Review = require('../models/reviewModel');

exports.alerts = (req, res, next) => {
  const { alert } = req.query;
  if (alert === 'booking')
    res.locals.alert =
      'Đặt tour của bạn đã thành công! Vui lòng kiểm tra email để xác nhận. Nếu đặt chỗ của bạn không hiển thị ở đây ngay lập tức, vui lòng quay lại sau.';
  next();
};

exports.getOverview = catchAsync(async (req, res, next) => {
  const tours = await Tour.find();
  const uniqueLocations = await Tour.distinct('startLocation.description');

  res.status(200).render('overview', {
    title: 'Tất cả chuyến đi',
    tours,
    uniqueLocations
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

exports.getTour = catchAsync(async (req, res, next) => {
  // 1) Lấy dữ liệu cho tour được yêu cầu
  const tour = await Tour.findOne({ slug: req.params.slug }).populate({
    path: 'reviews',
    fields: 'review rating user'
  });

  if (!tour) {
    return next(new AppError('Không tìm thấy dữ liệu nào', 404));
  }

  // 2) Xây dựng template
  // 3) Render template sử dụng dữ liệu từ 1)
  res.status(200).render('tour', {
    title: `${tour.name}`,
    tour
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
  // 1) Tìm tất cả các đặt tour
  const bookings = await Booking.find({ user: req.user.id });

  // 2) Tìm các tour với các ID đã trả về
  const tourIDs = bookings.map(el => el.tour);
  const tours = await Tour.find({ _id: { $in: tourIDs } });

  // 3) Tìm tất cả các đánh giá của người dùng
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

// Quản lý tour
exports.getManageTours = catchAsync(async (req, res, next) => {
  // Lấy tất cả các tour
  const tours = await Tour.find();

  res.status(200).render('manageTours', {
    title: 'Quản lý tour',
    tours
  });
});

exports.getNewTourForm = catchAsync(async (req, res, next) => {
  // Lấy tất cả hướng dẫn viên cho biểu mẫu, bao gồm cả những người không hoạt động
  const guides = await User.find({
    role: { $in: ['guide', 'lead-guide'] }
  }).select('+active');

  res.status(200).render('tourForm', {
    title: 'Tạo tour mới',
    guides
  });
});

exports.getEditTourForm = catchAsync(async (req, res, next) => {
  // Lấy tour
  const tour = await Tour.findById(req.params.id).populate('guides');

  if (!tour) {
    return next(new AppError('Không tìm thấy tour với ID này', 404));
  }

  // Lấy tất cả hướng dẫn viên cho biểu mẫu, bao gồm cả những người không hoạt động
  const guides = await User.find({
    role: { $in: ['guide', 'lead-guide'] }
  }).select('+active');

  res.status(200).render('tourForm', {
    title: `Chỉnh sửa tour: ${tour.name}`,
    tour,
    guides
  });
});

// Thêm các hàm xử lý cho quản lý người dùng
exports.getManageUsers = catchAsync(async (req, res, next) => {
  // Lấy tất cả người dùng bao gồm cả những người không hoạt động (quản trị viên có thể xem tất cả)
  // Đánh dấu đây là route quản lý để không lọc người dùng không hoạt động
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
    user: null // Đảm bảo người dùng là null khi tạo mới
  });
});

exports.getEditUserForm = catchAsync(async (req, res, next) => {
  // Lấy người dùng
  const user = await User.findById(req.params.id).select('+active');

  if (!user) {
    return next(new AppError('Không tìm thấy người dùng với ID này', 404));
  }

  res.status(200).render('userForm', {
    title: `Chỉnh sửa người dùng: ${user.name}`,
    user
  });
});

// Thêm các hàm xử lý cho quản lý đặt chỗ
exports.getManageBookings = catchAsync(async (req, res, next) => {
  // Lấy tất cả các đặt chỗ
  const bookings = await Booking.find();

  res.status(200).render('manageBookings', {
    title: 'Lịch sử đặt tour',
    bookings
  });
});

exports.getBookingDetail = catchAsync(async (req, res, next) => {
  // Lấy đặt chỗ
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(new AppError('Không tìm thấy đặt tour với ID này', 404));
  }

  res.status(200).render('bookingDetail', {
    title: `Chi tiết đặt tour: ${booking.tour.name}`,
    booking
  });
});

// Thêm hàm mới để hiển thị biểu mẫu đặt tour
exports.getBookingForm = catchAsync(async (req, res, next) => {
  // Lấy thông tin tour từ ID
  const tour = await Tour.findById(req.params.tourId);

  if (!tour) {
    return next(new AppError('Không tìm thấy tour với ID này', 404));
  }

  res.status(200).render('bookingForm', {
    title: `Đặt tour: ${tour.name}`,
    tour
  });
});

// Thêm hàm mới để hiển thị trang thông báo thanh toán thành công
exports.getBookingSuccess = catchAsync(async (req, res, next) => {
  // Lấy thông tin đặt chỗ từ query params
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
    // Nếu có bookingId, lấy thông tin đặt chỗ từ cơ sở dữ liệu
    booking = await Booking.findById(bookingId);

    if (!booking) {
      return next(new AppError('Không tìm thấy thông tin đặt tour', 404));
    }
  } else if (tour && user && price) {
    // Nếu không có bookingId nhưng có đủ thông tin để tạo đặt chỗ mới
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

  // Điền thông tin tour và người dùng
  await booking.populate([
    { path: 'tour', select: 'name startDates duration' },
    { path: 'user', select: 'name email' }
  ]);

  res.status(200).render('bookingSuccess', {
    title: 'Thanh toán thành công',
    booking
  });
});

// Thêm hàm mới để hiển thị trang quản lý đánh giá
exports.getManageReviews = catchAsync(async (req, res, next) => {
  // Lấy tất cả đánh giá với tour và người dùng đã được điền
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

// Thêm hàm mới để hiển thị hóa đơn
exports.getBookingInvoice = catchAsync(async (req, res, next) => {
  // Lấy thông tin đặt chỗ từ ID
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return next(new AppError('Không tìm thấy đặt tour với ID này', 404));
  }

  // Kiểm tra xem người dùng có quyền xem hóa đơn này không
  if (booking.user.id !== req.user.id && req.user.role !== 'admin') {
    return next(new AppError('Bạn không có quyền xem hóa đơn này', 403));
  }

  // Điền thông tin tour và người dùng
  await booking.populate([
    { path: 'tour', select: 'name startDates duration' },
    { path: 'user', select: 'name email' }
  ]);

  res.status(200).render('bookingInvoice', {
    title: `Hóa đơn: ${booking.tour.name}`,
    booking
  });
});

// Thêm hàm mới để hiển thị trang hóa đơn của tôi
exports.getMyBilling = catchAsync(async (req, res, next) => {
  // Lấy tất cả đặt chỗ của người dùng
  const bookings = await Booking.find({ user: req.user.id }).populate({
    path: 'tour',
    select: 'name'
  });

  res.status(200).render('myBilling', {
    title: 'Hóa đơn của tôi',
    bookings
  });
});

// Thêm hàm mới để hiển thị trang đánh giá của tôi
exports.getMyReviews = catchAsync(async (req, res, next) => {
  // Lấy tất cả đánh giá của người dùng
  const reviews = await Review.find({ user: req.user.id }).populate({
    path: 'tour',
    select: 'name imageCover slug'
  });

  res.status(200).render('myReviews', {
    title: 'Đánh giá của tôi',
    reviews
  });
});

// Thêm các bộ điều khiển cho quên mật khẩu và đặt lại mật khẩu
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
  // Lấy thống kê tổng quan
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

  // --- Lấy danh sách các năm có dữ liệu từ Booking ---
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
    // Nếu không có dữ liệu, lấy năm hiện tại
    availableYears = [new Date().getFullYear()];
  }

  // Lấy năm được chọn từ truy vấn, nếu không hợp lệ thì chọn năm mới nhất (hoặc bạn có thể chọn năm đầu tiên)
  let selectedYear = parseInt(req.query.year, 10);
  if (!selectedYear || !availableYears.includes(selectedYear)) {
    selectedYear = availableYears[availableYears.length - 1];
  }

  // Xác định khoảng thời gian của năm được chọn
  const startDate = new Date(selectedYear, 0, 1); // Ngày 1 tháng 1 của năm được chọn
  const endDate = new Date(selectedYear + 1, 0, 1); // Ngày 1 tháng 1 của năm tiếp theo

  // --- Lấy doanh thu ngày hiện tại ---
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

  // Định dạng ngày hiện tại
  const formattedDate = `${today.getDate()}/${today.getMonth() +
    1}/${today.getFullYear()}`;

  // --- Lấy doanh thu tháng hiện tại ---
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

  // Định dạng tháng hiện tại
  const formattedMonth = `${today.getMonth() + 1}/${today.getFullYear()}`;

  // --- Lấy doanh thu năm hiện tại ---
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

  // --- Tổng hợp doanh thu theo tháng cho năm được chọn ---
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

  // Định dạng dữ liệu doanh thu theo tháng
  const formattedRevenueData = months.map(month => ({ month, revenue: 0 }));
  revenueAggregation.forEach(item => {
    const monthIndex = item._id - 1;
    formattedRevenueData[monthIndex].revenue = item.totalRevenue;
  });

  // --- Tổng hợp doanh thu theo ngày, phân theo tháng cho năm được chọn ---
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

  // Render view và truyền các dữ liệu cần thiết, đặc biệt là availableYears và selectedYear
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
