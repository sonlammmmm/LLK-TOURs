const express = require('express');
const bookingController = require('../controllers/bookingController');
const authController = require('../controllers/authController');
const vnpayController = require('../controllers/vnpayController');

const router = express.Router();

// === STRIPE ===
router.get(
  '/checkout-session/:tourId',
  authController.protect,
  bookingController.checkBookingExists,
  bookingController.getCheckoutSession
);

// === VNPAY ===
router.get(
  '/create-vnpay-url',
  bookingController.checkBookingExists,
  vnpayController.createPaymentUrl
);

router.get('/vnpay-return', vnpayController.vnpayReturn);

router.get('/vnpay-ipn', vnpayController.vnpayIpn);

// === ADMIN ===
router.use(authController.protect);
router.use(authController.restrictTo('admin', 'lead-guide'));

router
  .route('/')
  .get(bookingController.getAllBookings)
  .post(bookingController.createBooking);

router
  .route('/:id')
  .get(bookingController.getBooking)
  .patch(bookingController.updateBooking)
  .delete(bookingController.deleteBooking);

module.exports = router;
