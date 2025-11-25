const express = require('express');
const viewsController = require('../controllers/viewsController');
const authController = require('../controllers/authController');
const bookingController = require('../controllers/bookingController');
const messageController = require('../controllers/messageController'); // 👈 thêm controller chat

const router = express.Router();

const setAuthLayout = (req, res, next) => {
  res.locals.hideHeader = true;
  res.locals.hideFooter = true;
  next();
};

const setUserPortalLayout = (req, res, next) => {
  res.locals.hideFooter = true;
  if (res.locals.pageClass) {
    res.locals.pageClass = `${res.locals.pageClass} user-portal-body`;
  } else {
    res.locals.pageClass = 'user-portal-body';
  }
  next();
};

// Middleware gắn thông tin user đã đăng nhập nếu có
router.use(authController.isLoggedIn);

// -------------------- TRANG NGƯỜI DÙNG --------------------
router.get('/', viewsController.getOverview);
router.get('/all', viewsController.getAllTours);
router.get('/search', authController.isLoggedIn, viewsController.searchTours);
router.get('/tour/:slug', authController.isLoggedIn, viewsController.getTour);
router.get('/login', setAuthLayout, viewsController.getLoginForm);
router.get('/signup', setAuthLayout, viewsController.getSignupForm);
router.get('/me', authController.protect, setUserPortalLayout, viewsController.getAccount);

// Route hiển thị chat của user (có thể dùng riêng hoặc qua nút chat nổi)
router.get(
  '/chat',
  authController.protect,
  authController.restrictTo('user'),
  setUserPortalLayout,
  messageController.getUserChatView
);

// Ẩn header/footer cho khối trang admin
router.use('/admin', (req, res, next) => {
  res.locals.hideHeader = true;
  res.locals.hideFooter = true;
  next();
});

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
router.get(
  '/forgot-password',
  setAuthLayout,
  viewsController.getForgotPasswordForm
);
router.get(
  '/reset-password/:token',
  setAuthLayout,
  viewsController.getResetPasswordForm
);

router.get('/booking-success', viewsController.getBookingSuccess);

router.get(
  '/booking-invoice/:id',
  authController.protect,
  setUserPortalLayout,
  viewsController.getBookingInvoice
);

router.get(
  '/my-tours',
  authController.protect,
  bookingController.createBookingCheckout,
  setUserPortalLayout,
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

router.get(
  '/admin/services',
  authController.protect,
  authController.restrictTo('admin'),
  viewsController.getManageServices
);

router.get(
  '/admin/services/new',
  authController.protect,
  authController.restrictTo('admin'),
  viewsController.getServiceForm
);

router.get(
  '/admin/services/:id/edit',
  authController.protect,
  authController.restrictTo('admin'),
  viewsController.getServiceForm
);

router.get(
  '/admin/promotions',
  authController.protect,
  authController.restrictTo('admin'),
  viewsController.getManagePromotions
);

router.get(
  '/admin/promotions/new',
  authController.protect,
  authController.restrictTo('admin'),
  viewsController.getPromotionForm
);

router.get(
  '/admin/promotions/:id/edit',
  authController.protect,
  authController.restrictTo('admin'),
  viewsController.getPromotionForm
);

router.get(
  '/admin/promotions/:id/assign',
  authController.protect,
  authController.restrictTo('admin'),
  viewsController.getPromotionAssignForm
);

// -------------------- QUẢN LÝ REVIEW --------------------
router.get(
  '/admin/reviews',
  authController.protect,
  authController.restrictTo('admin'),
  viewsController.getManageReviews
);

// -------------------- CÁ NHÂN --------------------
router.get('/my-billing', authController.protect, setUserPortalLayout, viewsController.getMyBilling);
router.get('/my-reviews', authController.protect, setUserPortalLayout, viewsController.getMyReviews);
router.get(
  '/my-promotions',
  authController.protect,
  setUserPortalLayout,
  viewsController.getMyPromotionsView
);

router.get(
  '/book-tour/:tourId',
  authController.protect,
  viewsController.getBookingForm
);

module.exports = router;
