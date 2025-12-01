const express = require('express');
const bookingController = require('../controllers/bookingController');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/momo/ipn', bookingController.handleMomoIpn);
router.get('/momo/redirect', bookingController.handleMomoRedirect);

router.use(authController.protect);

router
  .route('/checkout-session/:tourId')
  .get(bookingController.getCheckoutSession)
  .post(bookingController.getCheckoutSession);

router.post('/momo-session/:tourId', bookingController.createMomoPayment);

router.get('/by-session/:sid', bookingController.getByStripeSession);

router.get('/my', bookingController.getMyBookings);

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
