const express = require('express');
const viewsController = require('../controllers/viewsController');
const authController = require('../controllers/authController');
const bookingController = require('../controllers/bookingController');
const messageController = require('../controllers/messageController'); // 👈 thêm controller chat

const router = express.Router();

// Middleware kiểm tra đăng nhập
router.use(authController.isLoggedIn);

// -------------------- TRANG NGƯỜI DÙNG --------------------
router.get('/', viewsController.getOverview);
router.get('/search', authController.isLoggedIn, viewsController.searchTours);
router.get('/tour/:slug', authController.isLoggedIn, viewsController.getTour);
router.get('/login', viewsController.getLoginForm);
router.get('/signup', viewsController.getSignupForm);
router.get('/me', authController.protect, viewsController.getAccount);

// Route hiển thị chat của user (có thể dùng riêng hoặc qua nút chat nổi)
router.get(
  '/chat',
  authController.protect,
  authController.restrictTo('user'),
  messageController.getUserChatView
);

// -------------------- TRANG ADMIN --------------------
router.get(
  '/admin/dashboard',
  authController.protect,
  authController.restrictTo('admin'),
  viewsController.getDashboard
);

router.get(
  '/admin/chat',
  authController.protect,
  authController.restrictTo('admin'),
  messageController.getAdminChatView
);

// -------------------- CÁC TRANG CHỨC NĂNG KHÁC --------------------
router.get('/forgot-password', viewsController.getForgotPasswordForm);
router.get('/reset-password/:token', viewsController.getResetPasswordForm);

router.get(
  '/booking-success',
  authController.protect,
  viewsController.getBookingSuccess
);

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

// -------------------- QUẢN LÝ TOUR --------------------
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

// -------------------- QUẢN LÝ USER --------------------
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

// -------------------- QUẢN LÝ BOOKING --------------------
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

// -------------------- QUẢN LÝ REVIEW --------------------
router.get(
  '/admin/reviews',
  authController.protect,
  authController.restrictTo('admin'),
  viewsController.getManageReviews
);

// -------------------- CÁ NHÂN --------------------
router.get('/my-billing', authController.protect, viewsController.getMyBilling);
router.get('/my-reviews', authController.protect, viewsController.getMyReviews);

router.get(
  '/book-tour/:tourId',
  authController.protect,
  viewsController.getBookingForm
);

module.exports = router;
