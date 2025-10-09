const express = require('express');
const viewsController = require('../controllers/viewsController');
const authController = require('../controllers/authController');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

router.use(authController.isLoggedIn);

router.get('/', viewsController.getOverview);
router.get('/search', authController.isLoggedIn, viewsController.searchTours);

router.get('/tour/:slug', authController.isLoggedIn, viewsController.getTour);
router.get('/login', viewsController.getLoginForm);
router.get('/signup', viewsController.getSignupForm);
router.get('/me', authController.protect, viewsController.getAccount);

router.get(
  '/admin/dashboard',
  authController.protect,
  authController.restrictTo('admin'),
  viewsController.getDashboard
);

// Thêm các route cho quên mật khẩu và đặt lại mật khẩu
router.get('/forgot-password', viewsController.getForgotPasswordForm);
router.get('/reset-password/:token', viewsController.getResetPasswordForm);

// Thêm route mới cho trang thông báo thanh toán thành công
router.get(
  '/booking-success',
  authController.protect,
  viewsController.getBookingSuccess
);

// Thêm route mới cho trang xem hóa đơn
router.get(
  '/booking-invoice/:id',
  authController.protect,
  viewsController.getBookingInvoice
);

router.get(
  '/my-tours',
  bookingController.createBookingCheckout,
  authController.protect,
  viewsController.getMyTours
);

router.post(
  '/submit-user-data',
  authController.protect,
  viewsController.updateUserData
);

// Các route quản lý tour
router.get(
  '/admin/tours',
  authController.protect,
  authController.restrictTo('admin', 'lead-guide'),
  viewsController.getManageTours
);

router.get(
  '/admin/tours/new',
  authController.protect,
  authController.restrictTo('admin', 'lead-guide'),
  viewsController.getNewTourForm
);

router.get(
  '/admin/tours/:id/edit',
  authController.protect,
  authController.restrictTo('admin', 'lead-guide'),
  viewsController.getEditTourForm
);

// Các route quản lý người dùng
router.get(
  '/admin/users',
  authController.protect,
  authController.restrictTo('admin'),
  viewsController.getManageUsers
);

router.get(
  '/admin/users/new',
  authController.protect,
  authController.restrictTo('admin'),
  viewsController.getNewUserForm
);

router.get(
  '/admin/users/:id/edit',
  authController.protect,
  authController.restrictTo('admin'),
  viewsController.getEditUserForm
);

// Các route quản lý đặt chỗ
router.get(
  '/admin/bookings',
  authController.protect,
  authController.restrictTo('admin', 'lead-guide'),
  viewsController.getManageBookings
);

router.get(
  '/admin/bookings/:id',
  authController.protect,
  authController.restrictTo('admin', 'lead-guide'),
  viewsController.getBookingDetail
);

// Thêm route mới cho form đặt tour
router.get(
  '/book-tour/:tourId',
  authController.protect,
  viewsController.getBookingForm
);

// Thêm route mới cho quản lý đánh giá
router.get(
  '/admin/reviews',
  authController.protect,
  authController.restrictTo('admin'),
  viewsController.getManageReviews
);

// Thêm route mới cho trang hóa đơn của tôi
router.get('/my-billing', authController.protect, viewsController.getMyBilling);

// Thêm route mới cho trang đánh giá của tôi
router.get('/my-reviews', authController.protect, viewsController.getMyReviews);

module.exports = router;
