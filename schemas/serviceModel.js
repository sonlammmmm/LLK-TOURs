const mongoose = require('mongoose');
const slugify = require('slugify');

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Dịch vụ phải có tên'],
      trim: true,
      maxlength: [120, 'Tên dịch vụ tối đa 120 ký tự']
    },
    slug: {
      type: String,
      unique: true
    },
    code: {
      type: String,
      uppercase: true,
      trim: true,
      unique: true,
      sparse: true
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: 280
    },
    description: {
      type: String,
      trim: true
    },
    price: {
      type: Number,
      required: [true, 'Dịch vụ phải có giá bán'],
      min: [0, 'Giá dịch vụ không hợp lệ']
    },
    currency: {
      type: String,
      uppercase: true,
      default: 'VND'
    },
    chargeType: {
      type: String,
      enum: ['per-person', 'per-booking'],
      default: 'per-person'
    },
    allowMultiple: {
      type: Boolean,
      default: false
    },
    minQuantity: {
      type: Number,
      default: 1,
      min: [1, 'Số lượng tối thiểu phải lớn hơn 0']
    },
    maxQuantity: {
      type: Number,
      default: 1,
      min: [1, 'Số lượng tối đa phải lớn hơn 0']
    },
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public'
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },
    tags: {
      type: [String],
      default: []
    },
    isFeatured: {
      type: Boolean,
      default: false
    },
    displayOrder: {
      type: Number,
      default: 0
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    },
    archivedAt: Date,
    lastUsedAt: Date
  },
  {
    timestamps: true
  }
);

serviceSchema.pre('save', function(next) {
  if (this.isModified('name') || !this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }

  if (this.isModified('code') && this.code) {
    this.code = this.code.toUpperCase();
  }

  if (this.chargeType === 'per-person') {
    this.allowMultiple = false;
    this.minQuantity = 1;
    this.maxQuantity = 1;
  }

  next();
});

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;
