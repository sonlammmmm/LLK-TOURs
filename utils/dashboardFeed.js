const DEFAULT_AVATAR = '/img/users/default.jpg';

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND'
});

const toISODate = value => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const formatHumanDate = value => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const getSafeId = source => {
  if (!source) return null;
  if (typeof source === 'string') return source;
  if (source.toString) return source.toString();
  return null;
};

const formatRecentOrderCard = booking => {
  if (!booking) return null;
  const noteParts = [];
  if (booking.tour && booking.tour.name) {
    noteParts.push(booking.tour.name);
  }
  const startDateLabel = formatHumanDate(booking.startDate);
  if (startDateLabel) {
    noteParts.push(startDateLabel);
  }

  return {
    id: getSafeId(booking._id || booking.id),
    customer:
      (booking.user && booking.user.name) || booking.customer || 'Khách mới',
    note: noteParts.length ? noteParts.join(' · ') : 'Đơn mới',
    amount: currencyFormatter.format(
      typeof booking.price === 'number' ? booking.price : 0
    ),
    status: booking.paid ? 'Đã thanh toán' : 'Chưa thanh toán',
    createdAt: toISODate(booking.createdAt),
    startDate: toISODate(booking.startDate),
    paymentMethod: booking.paymentMethod || 'stripe'
  };
};

const formatReviewCard = review => {
  if (!review) return null;
  const reviewerPhoto =
    review.user && review.user.photo
      ? `/img/users/${review.user.photo}`
      : DEFAULT_AVATAR;
  const numericRating = Number(review.rating);
  const safeRating = Number.isFinite(numericRating)
    ? Math.round(numericRating)
    : 0;

  return {
    id: getSafeId(review._id || review.id),
    reviewer: (review.user && review.user.name) || review.reviewer || 'Ẩn danh',
    reviewerAvatar: reviewerPhoto,
    rating: safeRating,
    content: review.review || '',
    tourName:
      (review.tour && review.tour.name) || review.tourName || 'Tour đã xoá',
    tourSlug: review.tour && review.tour.slug ? review.tour.slug : '',
    tourId: getSafeId(
      (review.tour && (review.tour._id || review.tour.id)) || null
    ),
    isHidden: Boolean(review.isHidden),
    createdAt: toISODate(review.createdAt)
  };
};

module.exports = {
  formatRecentOrderCard,
  formatReviewCard
};
