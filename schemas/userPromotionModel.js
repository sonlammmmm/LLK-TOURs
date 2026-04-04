const mongoose = require('mongoose');

const userPromotionSchema = new mongoose.Schema(
  {
    promotion: {
      type: mongoose.Schema.ObjectId,
      ref: 'Promotion',
      required: true
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    code: {
      type: String,
      uppercase: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['assigned', 'active', 'used', 'expired', 'revoked'],
      default: 'active'
    },
    usageLimit: {
      type: Number,
      default: 1,
      min: [1, 'Giới hạn sử dụng không hợp lệ']
    },
    usageCount: {
      type: Number,
      default: 0
    },
    assignedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: Date,
    note: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

userPromotionSchema.index({ promotion: 1, user: 1 }, { unique: true });
userPromotionSchema.index({ user: 1, status: 1 });

userPromotionSchema.pre('save', function(next) {
  if (this.code) {
    this.code = this.code.toUpperCase();
  }
  next();
});

const UserPromotion = mongoose.model('UserPromotion', userPromotionSchema);

module.exports = UserPromotion;
