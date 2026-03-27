const express = require('express');
const siteSettingController = require('../controllers/siteSettingController');
const authController = require('../controllers/authController');

const router = express.Router();

// Public: lấy thông tin cài đặt website
router.get('/', siteSettingController.getSettings);

// Admin only: cập nhật cài đặt website
router.patch(
  '/',
  authController.protect,
  authController.restrictTo('admin'),
  siteSettingController.updateSettings
);

module.exports = router;
