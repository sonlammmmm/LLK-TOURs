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
      minlength: [10, 'Tên tour phải có nhiều hơn hoặc bằng 40 ký tự']
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
      set: val => Math.round(val * 10) / 10 // 4.666666, 46.6666, 47, 4.7
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
          // this only points to current doc on NEW document creation
          // Sửa lại validator để không kiểm tra khi giá trị là null hoặc undefined
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
    createdAt: {
      type: Date,
      default: Date.now(),
      select: false
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false
    },
    startLocation: {
      // GeoJSON
      type: {
        type: String,
        default: 'Point',
        enum: ['Point']
      },
      coordinates: [Number],
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

// tourSchema.index({ price: 1 });
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' });

tourSchema.virtual('durationWeeks').get(function() {
  return this.duration / 7;
});

// Virtual populate
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id'
});

// DOCUMENT MIDDLEWARE: runs before .save() and .create()
tourSchema.pre('save', function(next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});

tourSchema.pre('save', function(next) {
  if (this.startDates) {
    // Chuyển đổi các chuỗi thành đối tượng Date
    this.startDates = this.startDates.map(date => {
      if (typeof date === 'string') {
        return new Date(date);
      }
      return date;
    });
  }
  next();
});

tourSchema.pre(/^find/, function(next) {
  this.find({ secretTour: { $ne: true } });

  this.start = Date.now();
  next();
});

tourSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt'
  });

  next();
});

tourSchema.post(/^find/, function(docs, next) {
  console.log(`Query took ${Date.now() - this.start} milliseconds!`);
  next();
});

// AGGREGATION MIDDLEWARE
tourSchema.pre('aggregate', function(next) {
  console.log(this.pipeline());
  next();
});

tourSchema.virtual('nextStartDate').get(function() {
  if (!this.startDates || this.startDates.length === 0) return null;

  const now = new Date();
  const futureDates = this.startDates.filter(date => new Date(date) > now);

  if (futureDates.length === 0) return null;

  return futureDates.sort((a, b) => new Date(a) - new Date(b))[0];
});

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
