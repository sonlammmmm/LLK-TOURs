const express = require('express');
const faqController = require('../controllers/faqController');
const authController = require('../controllers/authController');

const router = express.Router();

// Public: lấy FAQ đang hoạt động
router.get('/active', faqController.getActiveFaqs);

// Admin only
router.use(authController.protect);
router.use(authController.restrictTo('admin'));

router
  .route('/')
  .get(faqController.getAllFaqs)
  .post(faqController.createFaq);

router
  .route('/:id')
  .get(faqController.getFaq)
  .patch(faqController.updateFaq)
  .delete(faqController.deleteFaq);

router.patch('/:id/toggle', faqController.toggleActive);

module.exports = router;
