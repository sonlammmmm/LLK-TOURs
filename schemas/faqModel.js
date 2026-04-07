const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, 'Vui lòng nhập câu hỏi'],
      trim: true,
      maxlength: [500, 'Câu hỏi không được vượt quá 500 ký tự']
    },
    answer: {
      type: String,
      required: [true, 'Vui lòng nhập câu trả lời'],
      trim: true,
      maxlength: [2000, 'Câu trả lời không được vượt quá 2000 ký tự']
    },
    //vị trí hiển thị, số càng nhỏ càng ưu tiên hiển thị trước
    displayOrder: {
      type: Number,
      default: 0
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

faqSchema.index({ active: 1, displayOrder: 1 });

const FAQ = mongoose.model('FAQ', faqSchema);

module.exports = FAQ;
