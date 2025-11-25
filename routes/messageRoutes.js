const express = require('express');
const messageController = require('../controllers/messageController');
const authController = require('../controllers/authController');

const router = express.Router();

// Tất cả routes yêu cầu đăng nhập
router.use(authController.protect);

// API: Lấy lịch sử chat giữa admin và user
router.get(
  '/history/:userId',
  authController.restrictTo('admin'),
  messageController.getChatHistory
);

// API: Lấy danh sách user có tin nhắn (cho admin, có phân trang)
router.get(
  '/users-with-messages',
  authController.restrictTo('admin'),
  messageController.getUsersWithMessages
);

// API: Tìm kiếm user để admin có thể nhắn tin trước hoặc khôi phục localStorage
router.get(
  '/search-users',
  authController.restrictTo('admin'),
  messageController.searchUsers
);

module.exports = router;
