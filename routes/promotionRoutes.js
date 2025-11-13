const express = require('express');
const authController = require('../controllers/authController');
const promotionController = require('../controllers/promotionController');

const router = express.Router();

router.use(authController.protect);

router.get('/mine', promotionController.getMyPromotions);
router.post('/preview', promotionController.previewBookingPromotion);

router.use(authController.restrictTo('admin'));

router
  .route('/')
  .get(promotionController.getPromotions)
  .post(promotionController.createPromotion);

router
  .route('/:id')
  .get(promotionController.getPromotion)
  .patch(promotionController.updatePromotion)
  .delete(promotionController.deletePromotion);

router.post('/:id/assign', promotionController.assignPromotionToUser);

module.exports = router;
