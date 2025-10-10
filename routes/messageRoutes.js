const express = require('express');
const messageController = require('../controllers/messageController');
const authController = require('../controllers/authController');

const router = express.Router();

// Tất cả routes đều cần đăng nhập
router.use(authController.protect);

// API lấy lịch sử chat giữa admin và 1 user
router.get('/history/:userId', messageController.getChatHistory);

// API lấy danh sách users có tin nhắn (cho admin)
router.get(
  '/users',
  authController.restrictTo('admin'),
  messageController.getUsersWithMessages
);

module.exports = router;
