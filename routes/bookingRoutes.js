const express = require('express');
const bookingController = require('../controllers/bookingController');
const authController = require('../controllers/authController');
const vnpayController = require('../controllers/vnpayController'); // 👈 thêm dòng này

const router = express.Router();

router.use(authController.protect);

// === STRIPE ===
router.get(
  '/checkout-session/:tourId',
  bookingController.checkBookingExists,
  bookingController.getCheckoutSession
);

// === VNPAY ===
router.get(
  '/create-vnpay-url',
  bookingController.checkBookingExists,
  vnpayController.createPaymentUrl
);
router.get(
  '/vnpay-return',
  authController.protect,
  vnpayController.vnpayReturn
);

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
