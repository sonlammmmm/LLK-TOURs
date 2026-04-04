const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Khuyến mãi phải có tên'],
      trim: true
    },
    code: {
      type: String,
      required: [true, 'Khuyến mãi phải có mã'],
      uppercase: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    discountType: {
      type: String,
      enum: ['percent', 'fixed'],
      default: 'percent'
    },
    discountValue: {
      type: Number,
      required: [true, 'Vui lòng nhập giá trị khuyến mãi'],
      min: [0, 'Giá trị khuyến mãi không hợp lệ']
    },
    maxDiscountAmount: {
      type: Number,
      min: [0, 'Giảm tối đa không hợp lệ']
    },
    minOrderAmount: {
      type: Number,
      min: [0, 'Giá trị đơn hàng tối thiểu không hợp lệ']
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: Date,
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'active', 'inactive', 'expired', 'archived'],
      default: 'draft'
    },
    audience: {
      type: String,
      enum: ['public', 'targeted'],
      default: 'public'
    },
    usageLimit: {
      type: Number,
      min: [1, 'Giới hạn sử dụng không hợp lệ']
    },
    usedCount: {
      type: Number,
      default: 0
    },
    perUserLimit: {
      type: Number,
      default: 1,
      min: [1, 'Mỗi user sử dụng tối thiểu 1 lần']
    },
    stackable: {
      type: Boolean,
      default: false
    },
    autoAssignOnSignup: {
      type: Boolean,
      default: false
    },
    totalDiscountGiven: {
      type: Number,
      default: 0
    },
    tags: {
      type: [String],
      default: []
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

promotionSchema.index({ code: 1 }, { unique: true });
promotionSchema.index({ status: 1, startDate: 1, endDate: 1 });

promotionSchema.methods.isCurrentlyActive = function(date = new Date()) {
  if (['inactive', 'archived', 'expired'].includes(this.status)) return false;
  if (this.startDate && date < this.startDate) return false;
  if (this.endDate && date > this.endDate) return false;
  if (this.usageLimit && this.usedCount >= this.usageLimit) return false;
  return true;
};

promotionSchema.methods.remainingUsages = function() {
  if (!this.usageLimit) return null;
  return Math.max(this.usageLimit - this.usedCount, 0);
};

promotionSchema.pre('save', function(next) {
  if (this.isModified('code') && this.code) {
    this.code = this.code.toUpperCase();
  }

  if (this.startDate && this.endDate && this.startDate > this.endDate) {
    return next(new Error('Ngày bắt đầu không thể lớn hơn ngày kết thúc'));
  }

  const now = new Date();
  if (this.endDate && now > this.endDate && this.status !== 'archived') {
    this.status = 'expired';
  } else if (
    this.startDate &&
    now < this.startDate &&
    !['inactive', 'archived'].includes(this.status)
  ) {
    this.status = 'scheduled';
  } else if (
    this.startDate &&
    now >= this.startDate &&
    !['inactive', 'archived', 'expired'].includes(this.status)
  ) {
    this.status = 'active';
  }

  next();
});

const Promotion = mongoose.model('Promotion', promotionSchema);

module.exports = Promotion;
