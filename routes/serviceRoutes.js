const express = require('express');
const authController = require('../controllers/authController');
const serviceController = require('../controllers/serviceController');

const router = express.Router();

router.use(authController.protect);

router.get('/public', serviceController.getActivePublicServices);

router.use(authController.restrictTo('admin'));

router
  .route('/')
  .get(serviceController.getServices)
  .post(serviceController.createService);

router
  .route('/:id')
  .get(serviceController.getService)
  .patch(serviceController.updateService)
  .delete(serviceController.deleteService);

router.patch('/:id/toggle', serviceController.toggleStatus);

module.exports = router;
