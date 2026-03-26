const express = require('express');
const contactController = require('../controllers/contactController');
const authController = require('../controllers/authController');

const router = express.Router();

// Public: gửi tin nhắn liên hệ (khách vãng lai, không cần đăng nhập)
router.post('/', contactController.submitContactMessage);

// Admin only
router.use(authController.protect);
router.use(authController.restrictTo('admin'));

router.get('/', contactController.getAllContactMessages);

router
  .route('/:id')
  .get(contactController.getContactMessage)
  .delete(contactController.deleteContactMessage);

router.patch('/:id/read', contactController.markAsRead);

module.exports = router;
