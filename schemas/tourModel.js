const mongoose = require('mongoose');
const slugify = require('slugify');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tour phải có tên'],
      unique: true,
      trim: true,
      maxlength: [40, 'Tên tour phải có ít hơn hoặc bằng 40 ký tự'],
      minlength: [10, 'Tên tour phải có nhiều hơn hoặc bằng 10 ký tự']
    },
    slug: String,
    duration: {
      type: Number,
      required: [true, 'Một tour phải có thời gian']
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'Một tour du lịch phải có quy mô nhóm']
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Đánh giá phải trên 1.0'],
      max: [5, 'Đánh giá phải dưới 5.0'],
      set: val => Math.round(val * 10) / 10
    },
    ratingsQuantity: {
      type: Number,
      default: 0
    },
    price: {
      type: Number,
      required: [true, 'Một tour phải có giá']
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function(val) {
          if (!val) return true;
          return val < this.price;
        },
        message: 'Giảm giá ({VALUE}) phải nhỏ hơn giá thực tế'
      }
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'Một tour du lịch phải có mô tả']
    },
    description: {
      type: String,
      trim: true
    },
    imageCover: {
      type: String,
      required: [true, 'Một tour du lịch phải có ảnh bìa']
    },
    images: [String],
    isHidden: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false
    },
    // CẤU TRÚC MỚI: startDates với availableSlots
    startDates: {
      type: [
        {
          date: {
            type: Date,
            required: [true, 'Ngày khởi hành là bắt buộc']
          },
          availableSlots: {
            type: Number,
            required: [true, 'Số slot khả dụng là bắt buộc'],
            min: [0, 'Số slot không thể âm']
          },
          _id: false
        }
      ],
      set: function(v) {
        //Nếu nhận chuỗi JSON
        if (typeof v === 'string') {
          try {
            const parsed = JSON.parse(v);
            if (Array.isArray(parsed)) {
              return parsed.map(d => ({
                date: new Date(d.date || d),
                availableSlots:
                  Number(
                    d.availableSlots != null
                      ? d.availableSlots
                      : this.maxGroupSize
                  ) || 0
              }));
            }
            // Nếu chỉ có 1 object đơn
            if (parsed && parsed.date) {
              return [
                {
                  date: new Date(parsed.date),
                  availableSlots:
                    Number(
                      parsed.availableSlots != null
                        ? parsed.availableSlots
                        : this.maxGroupSize
                    ) || 0
                }
              ];
            }
          } catch {
            return v;
          }
        }

        //Nếu nhận mảng string ISO dates
        if (Array.isArray(v) && typeof v[0] === 'string') {
          return v.map(d => ({
            date: new Date(d),
            availableSlots: this.maxGroupSize || 0
          }));
        }
        return v;
      }
    },

    secretTour: {
      type: Boolean,
      default: false
    },
    startLocation: {
      type: {
        type: String,
        enum: ['Point']
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: function(val) {
            if (val == null) return true;
            return Array.isArray(val) && val.length === 2;
          },
          message: 'Tọa độ phải là mảng [lng, lat]'
        }
      },
      address: String,
      description: String
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point']
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number
      }
    ],
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      }
    ]
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' });

tourSchema.virtual('durationWeeks').get(function() {
  return this.duration / 7;
});

tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id'
});

// MIDDLEWARE: bỏ startLocation nếu thiếu tọa độ
tourSchema.pre('save', function(next) {
  if (
    this.startLocation &&
    (!this.startLocation.coordinates ||
      this.startLocation.coordinates.length === 0)
  ) {
    this.startLocation = undefined;
  }
  next();
});

// MIDDLEWARE: Tự động tạo slug
tourSchema.pre('save', function(next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

// MIDDLEWARE: Xử lý startDates khi tạo/cập nhật
tourSchema.pre('save', function(next) {
  if (this.isNew && this.startDates && this.startDates.length > 0) {
    this.startDates = this.startDates.map(dateObj => {
      // Date thuần
      if (dateObj instanceof Date) {
        return { date: dateObj, availableSlots: this.maxGroupSize };
      }
      // Object có date nhưng không có availableSlots
      if (dateObj.date && dateObj.availableSlots === undefined) {
        return {
          date:
            dateObj.date instanceof Date
              ? dateObj.date
              : new Date(dateObj.date),
          availableSlots: this.maxGroupSize
        };
      }
      // Object đầy đủ
      return {
        date:
          dateObj.date instanceof Date ? dateObj.date : new Date(dateObj.date),
        availableSlots: dateObj.availableSlots
      };
    });
  }
  next();
});

tourSchema.pre(/^find/, function(next) {
  const baseFilter = { secretTour: { $ne: true } };
  if (!this._includeHiddenTours) {
    baseFilter.isHidden = { $ne: true };
  }
  this.find(baseFilter);
  next();
});

tourSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt'
  });
  next();
});

// Virtual: Lấy ngày khởi hành tiếp theo có slot
tourSchema.virtual('nextStartDate').get(function() {
  if (!this.startDates || this.startDates.length === 0) return null;

  const now = new Date();
  const availableDates = this.startDates.filter(
    dateObj => new Date(dateObj.date) > now && dateObj.availableSlots > 0
  );

  if (availableDates.length === 0) return null;

  return availableDates.sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  )[0].date;
});

// METHOD: Giảm slot cho ngày cụ thể
tourSchema.methods.decreaseSlots = async function(startDate, participants) {
  const dateStr = new Date(startDate).toISOString().split('T')[0];

  const dateIndex = this.startDates.findIndex(
    d => new Date(d.date).toISOString().split('T')[0] === dateStr
  );

  if (dateIndex === -1) {
    throw new Error('Không tìm thấy ngày khởi hành');
  }

  if (this.startDates[dateIndex].availableSlots < participants) {
    throw new Error('Không đủ slot cho số lượng người tham gia');
  }

  this.startDates[dateIndex].availableSlots -= participants;
  await this.save({ validateBeforeSave: false });
};

// METHOD: Tăng slot cho ngày cụ thể (khi hủy booking)
tourSchema.methods.increaseSlots = async function(startDate, participants) {
  const dateStr = new Date(startDate).toISOString().split('T')[0];

  const dateIndex = this.startDates.findIndex(
    d => new Date(d.date).toISOString().split('T')[0] === dateStr
  );

  if (dateIndex === -1) {
    throw new Error('Không tìm thấy ngày khởi hành');
  }

  // Không cho phép vượt quá maxGroupSize
  const newSlots = this.startDates[dateIndex].availableSlots + participants;
  this.startDates[dateIndex].availableSlots = Math.min(
    newSlots,
    this.maxGroupSize
  );

  await this.save({ validateBeforeSave: false });
};

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
