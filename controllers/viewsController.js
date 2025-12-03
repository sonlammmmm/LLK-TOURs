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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxGroup = Number(tour.maxGroupSize) || 0;

  return tour.startDates
    .map(dateObj => {
      const rawDate = dateObj && dateObj.date ? dateObj.date : dateObj;
      const dateValue = new Date(rawDate);
      if (!rawDate || Number.isNaN(dateValue.getTime())) return null;
      if (dateValue < today) return null;

      const slotsRaw =
        dateObj && dateObj.availableSlots != null
          ? Number(dateObj.availableSlots)
          : maxGroup;
      const availableSlots = Math.max(
        0,
        Number.isFinite(slotsRaw) ? slotsRaw : 0
      );
      const isFull = availableSlots <= 0;
      const isAlmostFull =
        availableSlots > 0 &&
        maxGroup > 0 &&
        availableSlots <= Math.max(1, Math.floor(maxGroup * 0.2));

      return {
        date: dateValue,
        dateISO: dateValue.toISOString(),
        dateFormatted: dateValue.toLocaleDateString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }),
        availableSlots,
        isFull,
        isAlmostFull
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

const getUserIdFromDoc = userRef => {
  if (!userRef) return null;
  if (userRef.id) return userRef.id.toString();
  if (userRef._id) return userRef._id.toString();
  if (typeof userRef === 'string') return userRef;
  if (typeof userRef.toString === 'function') return userRef.toString();
  return null;
};

const mapTourWithStartMeta = tour => {
  const upcomingStartDates = formatStartDatesWithSlots(tour);
  const nextAvailable = upcomingStartDates.find(date => !date.isFull) || null;
  const fallbackStart = upcomingStartDates[0] || null;
  const nextStart = nextAvailable || fallbackStart;
  const hasAvailableStartDate = Boolean(nextAvailable);
  const showSoldOutBadge =
    upcomingStartDates.length === 0 || !hasAvailableStartDate;

  return {
    ...tour,
    upcomingStartDates,
    nextStart,
    hasAvailableStartDate,
    showSoldOutBadge
  };
};

const normalizeText = value => {
  if (value == null) return '';
  let text = String(value);
  if (typeof text.normalize === 'function') {
    text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  return text
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();
};

const matchesSearchQuery = (tour, keyword) => {
  if (!keyword) return true;
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) return true;

  const fields = [
    tour.name,
    tour.summary,
    tour.description,
    tour.slug,
    tour.startLocation && tour.startLocation.description,
    tour.startLocation && tour.startLocation.address
  ];

  if (Array.isArray(tour.locations)) {
    tour.locations.forEach(location => {
      if (!location) return;
      fields.push(location.description, location.address);
    });
  }

  return fields.some(value => normalizeText(value).includes(normalizedKeyword));
};

const toNumberOrZero = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getCreatedTimestamp = tour => {
  if (!tour || !tour.createdAt) return 0;
  const createdDate = new Date(tour.createdAt);
  return Number.isNaN(createdDate.getTime()) ? 0 : createdDate.getTime();
};

const sortComparators = {
  'price-asc': (a, b) => toNumberOrZero(a.price) - toNumberOrZero(b.price),
  'price-desc': (a, b) => toNumberOrZero(b.price) - toNumberOrZero(a.price),
  'name-asc': (a, b) =>
    (a.name || '').localeCompare(b.name || '', 'vi', { sensitivity: 'base' }),
  'name-desc': (a, b) =>
    (b.name || '').localeCompare(a.name || '', 'vi', { sensitivity: 'base' }),
  'date-newest': (a, b) => getCreatedTimestamp(b) - getCreatedTimestamp(a),
  'date-oldest': (a, b) => getCreatedTimestamp(a) - getCreatedTimestamp(b)
};

const ratingComparators = {
  'rating-asc': (a, b) =>
    toNumberOrZero(a.ratingsAverage) - toNumberOrZero(b.ratingsAverage),
  'rating-desc': (a, b) =>
    toNumberOrZero(b.ratingsAverage) - toNumberOrZero(a.ratingsAverage)
};

const sortByUpcomingStartAvailability = (a, b) => {
  const aHas = Boolean(a.nextStart);
  const bHas = Boolean(b.nextStart);
  if (aHas === bHas) return 0;
  return aHas ? -1 : 1;
};

const applySortComparator = (collection, comparator) => {
  if (typeof comparator !== 'function') return false;
  collection.sort(comparator);
  return true;
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
  const toursWithMeta = tours.map(mapTourWithStartMeta);
  const uniqueLocations = await Tour.distinct('startLocation.description');

  res.status(200).render('overview', {
    title: 'Trang chủ',
    tours: toursWithMeta,
    uniqueLocations,
    noResults: toursWithMeta.length === 0,
    searchParams: req.query || {},
    pageClass: 'landing-page'
  });
});

const parsePositiveNumber = value => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

const matchesDuration = (tour, durationKey) => {
  if (!durationKey) return true;
  const duration = tour.duration || 0;
  if (durationKey === '2-4') return duration >= 2 && duration <= 4;
  if (durationKey === '5-7') return duration >= 5 && duration <= 7;
  if (durationKey === '8+') return duration >= 8;
  return true;
};

const matchesGroupSize = (tour, groupKey) => {
  if (!groupKey) return true;
  const size = tour.maxGroupSize || 0;
  if (groupKey === '6-10') return size >= 6 && size <= 10;
  if (groupKey === '11-20') return size >= 11 && size <= 20;
  if (groupKey === '21+') return size >= 21;
  return true;
};

const hasStartDateOnOrAfter = (tour, targetDate) => {
  if (!targetDate) return true;
  if (!tour.startDates) return false;
  return tour.startDates.some(dateObj => {
    const rawDate = dateObj && (dateObj.date || dateObj);
    if (!rawDate) return false;
    const current = new Date(rawDate);
    return current >= targetDate;
  });
};

exports.getAllTours = catchAsync(async (req, res, next) => {
  const rawTours = await Tour.find().lean();

  const { startDates = '', duration = '', groupSize = '' } = req.query;
  const searchQuery = req.query.search || req.query.name || '';
  const ratingOrder = req.query.ratingOrder || '';
  const sortKey = req.query.sort || '';
  const { minPrice, maxPrice } = req.query;

  const parsedMin = parsePositiveNumber(minPrice);
  const parsedMax = parsePositiveNumber(maxPrice);
  const hasMinPrice = parsedMin != null;
  const hasMaxPrice = parsedMax != null;

  const minPriceFloor = hasMinPrice ? parsedMin : 0;
  const maxPriceCeil = hasMaxPrice ? parsedMax : Number.MAX_SAFE_INTEGER;
  const finalMinPrice = Math.min(minPriceFloor, maxPriceCeil);
  const finalMaxPrice = Math.max(minPriceFloor, maxPriceCeil);
  let startDateFilter = startDates ? new Date(startDates) : null;
  if (startDateFilter && Number.isNaN(startDateFilter.getTime()))
    startDateFilter = null;

  const filteredTours = rawTours.filter(tour => {
    if (!matchesSearchQuery(tour, searchQuery)) {
      return false;
    }

    if (!matchesDuration(tour, duration)) return false;
    if (!matchesGroupSize(tour, groupSize)) return false;

    if (tour.price < finalMinPrice || tour.price > finalMaxPrice) {
      return false;
    }

    if (!hasStartDateOnOrAfter(tour, startDateFilter)) {
      return false;
    }

    return true;
  });

  const toursWithMeta = filteredTours.map(mapTourWithStartMeta);

  let sortApplied = applySortComparator(
    toursWithMeta,
    ratingComparators[ratingOrder]
  );

  if (!sortApplied) {
    sortApplied = applySortComparator(toursWithMeta, sortComparators[sortKey]);
  }

  if (!sortApplied) {
    toursWithMeta.sort(sortByUpcomingStartAvailability);
  }

  const filters = {
    search: searchQuery,
    startDates,
    duration,
    groupSize,
    minPrice: hasMinPrice ? finalMinPrice : null,
    maxPrice: hasMaxPrice ? finalMaxPrice : null,
    ratingOrder,
    sort: sortKey
  };

  res.status(200).render('all', {
    title: 'Tất cả chuyến đi',
    tours: toursWithMeta,
    filters,
    noTours: toursWithMeta.length === 0
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
    if (!Number.isNaN(searchDate.getTime())) {
      const nextDate = new Date(searchDate.getTime() + 24 * 60 * 60 * 1000);
      searchQuery.startDates = {
        $elemMatch: {
          date: {
            $gte: searchDate,
            $lt: nextDate
          }
        }
      };
    }
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
    noResults: tours.length === 0,
    pageClass: 'landing-page'
  });
});

//CẬP NHẬT: Thêm thông tin slot
exports.getTour = catchAsync(async (req, res, next) => {
  const tour = await Tour.findOne({ slug: req.params.slug }).populate({
    path: 'reviews',
    select: 'review rating user createdAt isHidden'
  });

  if (!tour) {
    return next(new AppError('Không tìm thấy dữ liệu nào', 404));
  }

  const currentUserId = req.user ? req.user.id.toString() : null;
  const rawReviews = Array.isArray(tour.reviews) ? tour.reviews : [];
  const visibleReviews = rawReviews.filter(review => {
    if (!review) return false;
    if (!review.isHidden) return true;
    if (!currentUserId) return false;
    return getUserIdFromDoc(review.user) === currentUserId;
  });

  // Format ngày khởi hành với thông tin slot
  const startDatesWithSlots = formatStartDatesWithSlots(tour);
  const bookingDateOptions = startDatesWithSlots.filter(
    date => date && !date.isFull
  );
  const displayStartEntry =
    bookingDateOptions[0] || startDatesWithSlots[0] || null;
  const hasUpcomingStart = Boolean(displayStartEntry);
  const hasAvailableStart = bookingDateOptions.length > 0;
  const tourStartMeta = {
    bookingDateOptions,
    primaryBookingOption: bookingDateOptions[0] || null,
    hasUpcomingStart,
    hasAvailableStart,
    nextDateDisplay: hasUpcomingStart
      ? displayStartEntry.dateFormatted
      : 'Đang cập nhật'
  };

  res.status(200).render('tour', {
    title: `${tour.name}`,
    tour,
    startDatesWithSlots,
    tourStartMeta,
    visibleReviews,
    currentUserId
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
        tour.startDates && tour.startDates.length && tour.startDates[0]?.date
          ? new Date(tour.startDates[0].date)
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
      const tourId = tour.id || (tour._id ? tour._id.toString() : null);
      const userReview = tourId ? reviewsMap[tourId] : null;
      // Check if userReview is not null or undefined
      const hasReviewed = userReview !== null && userReview !== undefined;

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
  const bookingFormMeta = {
    availableDates: startDatesWithSlots.filter(
      date => date && !date.isFull && date.availableSlots > 0
    )
  };

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
    bookingFormMeta,
    services,
    userPromotions,
    hideFooter: true,
    pageClass: 'booking-page'
  });
});

exports.getBookingSuccess = catchAsync(async (req, res, next) => {
  const { booking: bookingId, sid } = req.query;
  const providerRaw = (req.query.provider || 'stripe').toLowerCase();
  const providerKey = providerRaw === 'momo' ? 'momo' : 'stripe';
  const providerName = providerKey === 'momo' ? 'MoMo' : 'Stripe';

  let booking = null;
  if (bookingId) {
    booking = await Booking.findById(bookingId).populate('tour user');
  } else if (sid) {
    booking = await Booking.findOne({
      paymentMethod: providerKey,
      providerSessionId: sid
    }).populate('tour user');
  }

  const pending = !booking;

  return res.status(200).render('bookingSuccess', {
    title: pending ? 'Đang xác nhận thanh toán' : 'Thanh toán thành công',
    booking,
    pending,
    sid: sid || null,
    providerKey,
    providerName,
    hideFooter: true
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
    })
    .lean({ virtuals: true });

  res.status(200).render('manageReviews', {
    title: 'Quản lý đánh giá',
    reviews: Array.isArray(reviews)
      ? reviews.map(review => ({
          ...review,
          isHidden: Boolean(review.isHidden)
        }))
      : [],
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

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthIndex = today.getMonth();

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
    availableYears = [currentYear];
  }

  if (!availableYears.includes(currentYear)) {
    availableYears.push(currentYear);
  }
  availableYears.sort((a, b) => a - b);

  let selectedYear = parseInt(req.query.year, 10);
  if (!selectedYear || !availableYears.includes(selectedYear)) {
    selectedYear = currentYear;
  }

  const startDate = new Date(selectedYear, 0, 1);
  const endDate = new Date(selectedYear + 1, 0, 1);

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

  const currencyFormatter = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  });
  const formatBookingDate = date =>
    date
      ? `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
      : 'Ngày chưa xác định';
  const recentBookings = await Booking.find()
    .sort('-createdAt')
    .limit(4);
  const recentOrders = recentBookings.map(booking => {
    const noteParts = [];
    if (booking.tour && booking.tour.name) noteParts.push(booking.tour.name);
    if (booking.startDate) noteParts.push(formatBookingDate(booking.startDate));
    return {
      customer: (booking.user && booking.user.name) || 'Khách mới',
      note: noteParts.length ? noteParts.join(' · ') : 'Đơn mới',
      amount: currencyFormatter.format(booking.price || 0),
      status: booking.paid ? 'Đã thanh toán' : 'Chưa thanh toán'
    };
  });

  const bookingStatusBreakdown = [
    { label: 'Đã thanh toán', value: paidBookings },
    { label: 'Chưa thanh toán', value: unpaidBookings }
  ];
  const entityTotals = [
    { label: 'Tour', value: totalTours },
    { label: 'Người dùng', value: totalUsers },
    { label: 'Đơn đặt tour', value: totalBookings }
  ];
  const conversionPercentage = totalBookings
    ? ((paidBookings / totalBookings) * 100).toFixed(1)
    : '0.0';

  res.status(200).render('dashboard', {
    title: 'Bảng điều khiển quản lý',
    stats: {
      totalTours,
      totalBookings,
      totalUsers,
      totalReviews,
      paidBookings,
      unpaidBookings,
      conversionRate: `${conversionPercentage}%`,
      recentOrders
    },
    revenueData: formattedRevenueData,
    dailyRevenueByMonth,
    selectedYear,
    availableYears,
    currentMonthIndex,
    monthLabels: months,
    bookingStatusBreakdown,
    entityTotals,
    todayRevenue: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
    monthRevenue: monthRevenue.length > 0 ? monthRevenue[0].total : 0,
    yearRevenue: yearRevenue.length > 0 ? yearRevenue[0].total : 0,
    formattedDate,
    formattedMonth,
    currentYear: today.getFullYear(),
    adminMenuActive: 'dashboard'
  });
});
