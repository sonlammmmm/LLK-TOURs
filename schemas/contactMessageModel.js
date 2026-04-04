const mongoose = require('mongoose');
const validator = require('validator');

const contactMessageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vui lòng nhập họ tên'],
      trim: true,
      maxlength: [100, 'Họ tên không được vượt quá 100 ký tự']
    },
    email: {
      type: String,
      required: [true, 'Vui lòng nhập email'],
      lowercase: true,
      validate: [validator.isEmail, 'Vui lòng nhập email hợp lệ']
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, 'Số điện thoại không hợp lệ']
    },
    subject: {
      type: String,
      required: [true, 'Vui lòng nhập tiêu đề'],
      trim: true,
      maxlength: [200, 'Tiêu đề không được vượt quá 200 ký tự']
    },
    message: {
      type: String,
      required: [true, 'Vui lòng nhập nội dung tin nhắn'],
      trim: true,
      maxlength: [3000, 'Nội dung không được vượt quá 3000 ký tự']
    },
    isRead: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

contactMessageSchema.index({ isRead: 1, createdAt: -1 });

const ContactMessage = mongoose.model('ContactMessage', contactMessageSchema);

module.exports = ContactMessage;
