const express = require('express');
const bookingController = require('../controllers/bookingController');
const authController = require('../controllers/authController');

const router = express.Router();

router.get('/by-session/:sid', bookingController.getByStripeSession);

// === STRIPE ===
router.post(
  '/checkout-session/:tourId',
  authController.protect,
  bookingController.getCheckoutSession
);

router.use(authController.protect);

router.get('/my', bookingController.getMyBookings);

// ADMIN/LEAD-GUIDE
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
