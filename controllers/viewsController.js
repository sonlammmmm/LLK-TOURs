const mongoose = require('mongoose');
const Tour = require('../schemas/tourModel');
const User = require('../schemas/userModel');
const Booking = require('../schemas/bookingModel');
const Service = require('../schemas/serviceModel');
const Promotion = require('../schemas/promotionModel');
const UserPromotion = require('../schemas/userPromotionModel');
const FAQ = require('../schemas/faqModel');
const ContactMessage = require('../schemas/contactMessageModel');
const SiteSetting = require('../schemas/siteSettingModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Review = require('../schemas/reviewModel');
const {
  formatRecentOrderCard,
  formatReviewCard
} = require('../utils/dashboardFeed');

// ==================== HELPER FUNCTIONS ====================

// Format startDates của tour: lọc ngày quá khứ, tính slot, đánh dấu hết chỗ / sắp hết
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

// Trích userId từ document (hỗ trợ cả populate lẫn plain ObjectId)
const getUserIdFromDoc = userRef => {
  if (!userRef) return null;
  if (userRef.id) return userRef.id.toString();
  if (userRef._id) return userRef._id.toString();
  if (typeof userRef === 'string') return userRef;
  if (typeof userRef.toString === 'function') return userRef.toString();
  return null;
};

// Trích tourId từ document (hỗ trợ cả populate lẫn plain ObjectId)
const getTourIdFromDoc = tourRef => {
  if (!tourRef) return null;
  if (tourRef.id) return tourRef.id.toString();
  if (tourRef._id) return tourRef._id.toString();
  if (typeof tourRef === 'string') return tourRef;
  if (typeof tourRef.toString === 'function') return tourRef.toString();
  return null;
};

// Đếm số review bị ẩn của user cho từng tour (Map<tourId, count>)
const buildHiddenReviewCountMap = async (userId, tourRefs = []) => {
  if (!userId) return new Map();
  const normalizedIds = Array.isArray(tourRefs)
    ? tourRefs.map(getTourIdFromDoc).filter(Boolean)
    : [];
  const uniqueIds = [...new Set(normalizedIds)];
  const objectIds = uniqueIds
    .map(id => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const query = {
    user: userId,
    isHidden: true
  };
  if (objectIds.length > 0) {
    query.tour = { $in: objectIds };
  }
  const hiddenReviews = await Review.find(query)
    .select('tour')
    .lean();
  return hiddenReviews.reduce((acc, review) => {
    const key =
      review.tour && typeof review.tour.toString === 'function'
        ? review.tour.toString()
        : review.tour;
    if (!key) return acc;
    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map());
};

// Đếm số review hiển thị (không bị ẩn) cho từng tour (Map<tourId, count>)
const buildVisibleReviewCountMap = async (tourRefs = []) => {
  const normalizedIds = Array.isArray(tourRefs)
    ? tourRefs.map(getTourIdFromDoc).filter(Boolean)
    : [];
  if (normalizedIds.length === 0) return new Map();
  const objectIds = [...new Set(normalizedIds)]
    .map(id => {
      try {
        return new mongoose.Types.ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  if (objectIds.length === 0) return new Map();
  const counts = await Review.aggregate([
    { $match: { tour: { $in: objectIds }, isHidden: { $ne: true } } },
    {
      $group: {
        _id: '$tour',
        count: { $sum: 1 }
      }
    }
  ]);
  return counts.reduce((acc, item) => {
    const key =
      item._id && typeof item._id.toString === 'function'
        ? item._id.toString()
        : item._id;
    if (!key) return acc;
    acc.set(key, item.count || 0);
    return acc;
  }, new Map());
};

// Tính ratingsQuantity hiển thị (cộng thêm review ẩn của chính user)
const getDisplayRatingsQuantity = (tour, hiddenReviewMap) => {
  if (!tour) return 0;
  const baseCount =
    typeof tour.ratingsQuantity === 'number' ? tour.ratingsQuantity : 0;
  if (!hiddenReviewMap || hiddenReviewMap.size === 0) {
    return baseCount;
  }
  const tourId = getTourIdFromDoc(tour);
  if (!tourId) return baseCount;
  const hiddenExtras = hiddenReviewMap.get(tourId) || 0;
  return baseCount + hiddenExtras;
};

// Gắn metadata khởi hành cho tour (ngày gần nhất, sold out badge, ...)
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

// Chuẩn hoá text tiếng Việt (bỏ dấu, lowercase) để so sánh tìm kiếm
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

// Kiểm tra tour có khớp từ khoá tìm kiếm không (name, summary, locations, ...)
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

// Ép giá trị về số, trả 0 nếu không hợp lệ
const toNumberOrZero = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Lấy timestamp createdAt của tour (dùng cho sort)
const getCreatedTimestamp = tour => {
  if (!tour || !tour.createdAt) return 0;
  const createdDate = new Date(tour.createdAt);
  return Number.isNaN(createdDate.getTime()) ? 0 : createdDate.getTime();
};

// Bộ so sánh sắp xếp theo giá / tên / ngày tạo
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

// Bộ so sánh sắp xếp theo rating
const ratingComparators = {
  'rating-asc': (a, b) =>
    toNumberOrZero(a.ratingsAverage) - toNumberOrZero(b.ratingsAverage),
  'rating-desc': (a, b) =>
    toNumberOrZero(b.ratingsAverage) - toNumberOrZero(a.ratingsAverage)
};

// Ưu tiên tour có ngày khởi hành sắp tới lên trước
const sortByUpcomingStartAvailability = (a, b) => {
  const aHas = Boolean(a.nextStart);
  const bHas = Boolean(b.nextStart);
  if (aHas === bHas) return 0;
  return aHas ? -1 : 1;
};

// Áp dụng comparator sort lên mảng, trả true nếu sort được
const applySortComparator = (collection, comparator) => {
  if (typeof comparator !== 'function') return false;
  collection.sort(comparator);
  return true;
};

// ==================== TRANG CHỦ (LANDING) ====================

// Middleware: hiển thị thông báo thanh toán thành công nếu có query ?alert=booking
exports.alerts = (req, res, next) => {
  const { alert } = req.query;
  if (alert === 'booking')
    res.locals.alert =
      'Đặt tour của bạn đã thành công! Vui lòng kiểm tra email để xác nhận. Nếu đặt chỗ của bạn không hiển thị ở đây ngay lập tức, vui lòng quay lại sau.';
  next();
};

// Trang chủ (landing page): hiển thị slider tour + danh sách địa điểm
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

// ==================== DANH SÁCH & TÌM KIẾM TOUR ====================

// Helper: parse số dương, trả null nếu không hợp lệ
const parsePositiveNumber = value => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

// Lọc theo thời lượng tour (2-4, 5-7, 8+ ngày)
const matchesDuration = (tour, durationKey) => {
  if (!durationKey) return true;
  const duration = tour.duration || 0;
  if (durationKey === '2-4') return duration >= 2 && duration <= 4;
  if (durationKey === '5-7') return duration >= 5 && duration <= 7;
  if (durationKey === '8+') return duration >= 8;
  return true;
};

// Lọc theo quy mô nhóm (6-10, 11-20, 21+)
const matchesGroupSize = (tour, groupKey) => {
  if (!groupKey) return true;
  const size = tour.maxGroupSize || 0;
  if (groupKey === '6-10') return size >= 6 && size <= 10;
  if (groupKey === '11-20') return size >= 11 && size <= 20;
  if (groupKey === '21+') return size >= 21;
  return true;
};

// Kiểm tra tour có ngày khởi hành >= targetDate không
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

// Trang "Tất cả tour": lọc/sắp xếp theo search, giá, duration, groupSize, rating, ngày
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
  const [visibleReviewCountMap, hiddenReviewCountMap] = await Promise.all([
    buildVisibleReviewCountMap(toursWithMeta),
    buildHiddenReviewCountMap(req.user ? req.user.id : null, toursWithMeta)
  ]);
  toursWithMeta.forEach(tour => {
    const tourId = getTourIdFromDoc(tour);
    if (tourId && visibleReviewCountMap.has(tourId)) {
      tour.ratingsQuantity = visibleReviewCountMap.get(tourId);
    }
    tour.displayRatingsQuantity = getDisplayRatingsQuantity(
      tour,
      hiddenReviewCountMap
    );
  });

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

// Tìm kiếm tour theo tên, ngày khởi hành, địa điểm xuất phát (trang landing)
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

// ==================== CHI TIẾT TOUR ====================

// Trang chi tiết tour: hiển thị review (ẩn review bị hidden trừ chủ), slot khởi hành
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

  tour.displayRatingsQuantity = visibleReviews.length;

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

// ==================== XÁC THỰC ====================

// Form đăng nhập
exports.getLoginForm = (req, res) => {
  res.status(200).render('login', {
    title: 'Đăng nhập'
  });
};

// Form đăng ký
exports.getSignupForm = (req, res) => {
  res.status(200).render('signup', {
    title: 'Đăng ký'
  });
};

// ==================== USER PORTAL ====================

// Trang cài đặt tài khoản
exports.getAccount = (req, res) => {
  res.status(200).render('account', {
    title: 'Tài khoản của bạn'
  });
};

// Trang "Tour của tôi": danh sách booking + trạng thái + review + thống kê tổng chi
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

// Cập nhật thông tin user qua form (name, email) — không dùng API
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

// ==================== ADMIN: QUẢN LÝ TOUR ====================

// Trang quản lý tour: hiển thị tất cả tour + thống kê slot/booking sắp tới
exports.getManageTours = catchAsync(async (req, res, next) => {
  const tourQuery = Tour.find();
  tourQuery._includeHiddenTours = true;
  const toursRaw = await tourQuery;
  const now = new Date();
  const hiddenReviewCountMap = await buildHiddenReviewCountMap(
    req.user ? req.user.id : null,
    toursRaw
  );

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

  const bookingTotals = await Booking.aggregate([
    {
      $group: {
        _id: '$tour',
        total: { $sum: 1 }
      }
    }
  ]);

  const bookingTotalMap = bookingTotals.reduce((acc, stat) => {
    if (!stat || !stat._id) return acc;
    acc[stat._id.toString()] = stat.total || 0;
    return acc;
  }, {});

  const tours = toursRaw.map(tour => {
    const tourObj = tour.toObject();
    tourObj.displayRatingsQuantity = getDisplayRatingsQuantity(
      tourObj,
      hiddenReviewCountMap
    );
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
    tourObj.totalTransactions = bookingTotalMap[tourId] || 0;
    tourObj.hasTransactions = tourObj.totalTransactions > 0;
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

// Form tạo tour mới (load danh sách guide)
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

// Form chỉnh sửa tour (load tour + danh sách guide)
exports.getEditTourForm = catchAsync(async (req, res, next) => {
  const tourQueryById = Tour.findById(req.params.id).populate('guides');
  tourQueryById._includeHiddenTours = true;
  const tour = await tourQueryById;

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

// ==================== ADMIN: QUẢN LÝ USER ====================

// Trang danh sách user (bao gồm cả tài khoản đã vô hiệu)
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

// Form tạo user mới
exports.getNewUserForm = catchAsync(async (req, res, next) => {
  res.status(200).render('userForm', {
    title: 'Tạo người dùng mới',
    user: null,
    adminMenuActive: 'users'
  });
});

// Form chỉnh sửa user
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

// ==================== ADMIN: QUẢN LÝ BOOKING ====================

// Trang lịch sử đặt tour (sắp xếp mới nhất trước)
exports.getManageBookings = catchAsync(async (req, res, next) => {
  const bookings = await Booking.find()
    .sort('-createdAt')
    .populate({ path: 'tour', select: 'name' })
    .populate({ path: 'user', select: 'name email photo' });

  res.status(200).render('manageBookings', {
    title: 'Lịch sử đặt tour',
    bookings,
    adminMenuActive: 'bookings'
  });
});

// ==================== ADMIN: QUẢN LÝ DỊCH VỤ ====================

// Trang quản lý dịch vụ
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

// Form tạo/chỉnh sửa dịch vụ
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

// ==================== ADMIN: QUẢN LÝ KHUYẾN MÃI ====================

// Trang danh sách khuyến mãi
exports.getManagePromotions = catchAsync(async (req, res, next) => {
  const promotions = await Promotion.find().sort('-createdAt');

  res.status(200).render('managePromotions', {
    title: 'Quản lý khuyến mãi',
    promotions,
    adminMenuActive: 'promotions'
  });
});

// Form tạo/chỉnh sửa khuyến mãi
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

// Form gắn mã khuyến mãi cho user cụ thể
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

// Trang "Mã khuyến mãi của tôi" (user xem mã còn hiệu lực)
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
// ==================== ĐẶT TOUR & THANH TOÁN ====================

// Trang chi tiết đặt tour (admin)
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

// Form đặt tour: load tour, slot, dịch vụ, mã khuyến mãi của user
exports.getBookingForm = catchAsync(async (req, res, next) => {
  const tour = await Tour.findById(req.params.tourId);

  if (!tour) {
    return next(new AppError('Không tìm thấy tour với ID này', 404));
  }

  const hiddenReviewCountMap = await buildHiddenReviewCountMap(
    req.user ? req.user.id : null,
    [tour]
  );
  tour.displayRatingsQuantity = getDisplayRatingsQuantity(
    tour,
    hiddenReviewCountMap
  );

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

// Trang xác nhận thanh toán thành công (Stripe / MoMo)
exports.getBookingSuccess = catchAsync(async (req, res, next) => {
  const { booking: bookingId, sid } = req.query;
  const providerRaw = (req.query.provider || 'stripe').toLowerCase();
  const providerKey = ['momo', 'cash'].includes(providerRaw)
    ? providerRaw
    : 'stripe';
  let providerName = 'Stripe';
  if (providerKey === 'momo') {
    providerName = 'MoMo';
  } else if (providerKey === 'cash') {
    providerName = 'Tiền mặt';
  }

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

// ==================== ADMIN: QUẢN LÝ ĐÁNH GIÁ ====================

// Trang quản lý đánh giá (admin): hiển thị tất cả kèm trạng thái ẩn/hiện
exports.getManageReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.find()
    .sort('-createdAt')
    .populate({
      path: 'user',
      select: 'name photo'
    })
    .populate({
      path: 'tour',
      select: 'name'
    })
    .lean({ virtuals: true });

  const safeReviews = Array.isArray(reviews)
    ? reviews
        .filter(review => review && review.user && review.tour)
        .map(review => ({
          ...review,
          isHidden: Boolean(review.isHidden)
        }))
    : [];

  res.status(200).render('manageReviews', {
    title: 'Quản lý đánh giá',
    reviews: safeReviews,
    adminMenuActive: 'reviews'
  });
});

// ==================== HÓA ĐƠN ====================

// Trang hoá đơn chi tiết (chỉ chủ booking hoặc admin xem được)
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

// Trang "Hóa đơn của tôi" (danh sách hoá đơn user)
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

// Trang "Đánh giá của tôi" (user xem review mình đã viết)
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

// ==================== QUÊN / ĐẶT LẠI MẬT KHẨU ====================

// Form quên mật khẩu
exports.getForgotPasswordForm = (req, res) => {
  res.status(200).render('forgotPassword', {
    title: 'Quên mật khẩu'
  });
};

// Form đặt lại mật khẩu (nhận token từ email)
exports.getResetPasswordForm = (req, res) => {
  res.status(200).render('resetPassword', {
    title: 'Đặt lại mật khẩu',
    token: req.params.token
  });
};

// ==================== DASHBOARD ADMIN ====================

// Bảng điều khiển: thống kê tổng quan, doanh thu theo ngày/tháng/năm, biểu đồ, top tour
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

  const [
    recentBookings,
    topProductAggregation,
    latestReviewDocs
  ] = await Promise.all([
    Booking.find()
      .sort('-createdAt')
      .limit(6)
      .lean(),
    Booking.aggregate([
      { $match: { paid: true, tour: { $ne: null } } },
      {
        $group: {
          _id: '$tour',
          totalRevenue: { $sum: '$price' },
          totalSales: {
            $sum: {
              $cond: [{ $gt: ['$participants', 0] }, '$participants', 1]
            }
          }
        }
      },
      { $sort: { totalSales: -1, totalRevenue: -1 } },
      { $limit: 5 }
    ]),
    Review.find()
      .sort('-createdAt')
      .limit(6)
      .populate({ path: 'tour', select: 'name slug' })
      .lean()
  ]);

  const recentOrders = recentBookings
    .map(formatRecentOrderCard)
    .filter(Boolean);

  const topTourIds = topProductAggregation
    .map(item => item._id)
    .filter(Boolean);
  let tourMap = new Map();
  if (topTourIds.length > 0) {
    const tourDocs = await Tour.find({ _id: { $in: topTourIds } })
      .select('name slug price')
      .lean();
    tourMap = new Map(tourDocs.map(t => [t._id.toString(), t]));
  }

  const totalTopRevenue = topProductAggregation.reduce(
    (sum, item) => sum + (item.totalRevenue || 0),
    0
  );

  const topProducts = topProductAggregation
    .map(item => {
      const tourId = item._id ? item._id.toString() : null;
      if (!tourId) return null;
      const tourInfo = tourMap.get(tourId);
      const share = totalTopRevenue
        ? Math.round((item.totalRevenue / totalTopRevenue) * 100)
        : 0;
      return {
        id: tourId,
        name: tourInfo ? tourInfo.name : 'Tour ?? xo?',
        sales: item.totalSales || 0,
        revenue: currencyFormatter.format(item.totalRevenue || 0),
        growth: share
      };
    })
    .filter(Boolean);

  const latestReviews = latestReviewDocs.map(formatReviewCard).filter(Boolean);

  const bookingStatusBreakdown = [
    { label: 'Đã thanh toán', value: paidBookings },
    { label: 'Chưa thanh toán', value: unpaidBookings }
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
      recentOrders,
      topProducts,
      latestReviews
    },
    revenueData: formattedRevenueData,
    dailyRevenueByMonth,
    selectedYear,
    availableYears,
    currentMonthIndex,
    monthLabels: months,
    bookingStatusBreakdown,
    todayRevenue: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
    monthRevenue: monthRevenue.length > 0 ? monthRevenue[0].total : 0,
    yearRevenue: yearRevenue.length > 0 ? yearRevenue[0].total : 0,
    formattedDate,
    formattedMonth,
    currentYear: today.getFullYear(),
    adminMenuActive: 'dashboard'
  });
});

// ==================== ABOUT / FAQ ====================

// Trang giới thiệu kèm danh sách FAQ đang hoạt động
exports.getAboutPage = catchAsync(async (req, res, next) => {
  const faqs = await FAQ.find({ active: true }).sort({
    displayOrder: 1,
    createdAt: -1
  });

  res.status(200).render('about', {
    title: 'Giới thiệu',
    faqs
  });
});

// Trang quản lý FAQ (admin)
exports.getManageFaqs = catchAsync(async (req, res, next) => {
  const faqs = await FAQ.find().sort({
    displayOrder: 1,
    createdAt: -1
  });

  res.status(200).render('manageFaqs', {
    title: 'Quản lý FAQ',
    faqs,
    adminMenuActive: 'faqs'
  });
});

// ==================== TRANG LIÊN HỆ (CONTACT) =====================

// Trang liên hệ (hiển thị cho khách)
exports.getContactPage = catchAsync(async (req, res, next) => {
  res.status(200).render('contact', {
    title: 'Liên hệ'
  });
});

// Trang quản lý hòm thư góp ý (admin)
exports.getManageContacts = catchAsync(async (req, res, next) => {
  const messages = await ContactMessage.find().sort({
    isRead: 1,
    createdAt: -1
  });

  res.status(200).render('manageContacts', {
    title: 'Hòm thư góp ý',
    messages,
    adminMenuActive: 'contacts'
  });
});

// ==================== CÀI ĐẶT WEBSITE (SITE SETTINGS) =====================

exports.getManageSiteSettings = catchAsync(async (req, res, next) => {
  const settings = await SiteSetting.getSettings();

  res.status(200).render('manageSiteSettings', {
    title: 'Cài đặt Website',
    settings,
    adminMenuActive: 'site-settings'
  });
});
