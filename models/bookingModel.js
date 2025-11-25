const mongoose = require('mongoose');
const Tour = require('./tourModel');

const bookingSchema = new mongoose.Schema({
  tour: {
    type: mongoose.Schema.ObjectId,
    ref: 'Tour',
    required: [true, 'Booking phải thuộc về một Tour!']
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Booking phải thuộc về một User!']
  },
  price: {
    type: Number,
    required: [true, 'Booking phải có giá.']
  },
  participants: {
    type: Number,
    default: 1,
    min: [1, 'Một Booking phải có ít nhất 1 người tham gia'],
    required: [true, 'Booking phải có số lượng người tham gia']
  },
  createdAt: {
    type: Date,
    default: Date.now()
  },
  paid: {
    type: Boolean,
    default: true
  },
  startDate: {
    type: Date,
    required: [true, 'Booking phải có ngày bắt đầu!']
  },
  paymentMethod: {
    type: String,
    enum: ['stripe'],
    default: 'stripe'
  },
  // ✅ THÊM TRƯỜNG NÀY
  providerSessionId: {
    type: String,
    unique: true,
    sparse: true // Cho phép null/undefined
  },
  currency: {
    type: String,
    uppercase: true,
    default: 'VND'
  },
  basePrice: {
    type: Number,
    default: 0
  },
  services: {
    type: [
      {
        service: {
          type: mongoose.Schema.ObjectId,
          ref: 'Service'
        },
        name: String,
        chargeType: {
          type: String,
          enum: ['per-person', 'per-booking']
        },
        price: Number,
        quantity: {
          type: Number,
          default: 1
        },
        total: Number
      }
    ],
    default: []
  },
  servicesTotal: {
    type: Number,
    default: 0
  },
  subtotal: {
    type: Number,
    default: 0
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  promotionSnapshot: {
    promotion: {
      type: mongoose.Schema.ObjectId,
      ref: 'Promotion'
    },
    userPromotion: {
      type: mongoose.Schema.ObjectId,
      ref: 'UserPromotion'
    },
    code: String,
    name: String,
    discountType: {
      type: String,
      enum: ['percent', 'fixed']
    },
    discountValue: Number
  },
  softLock: {
    type: mongoose.Schema.ObjectId,
    ref: 'BookingHold',
    default: null
  }
});

bookingSchema.index({ tour: 1 });
bookingSchema.index({ user: 1 });
// ✅ THÊM INDEX CHO WEBHOOK QUERY
bookingSchema.index({ paymentMethod: 1, providerSessionId: 1 });
bookingSchema.index({ softLock: 1 });

// MIDDLEWARE: Giảm slot khi tạo booking
bookingSchema.post('save', async doc => {
  try {
    if (doc.softLock) return;
    const tour = await Tour.findById(doc.tour);
    if (tour) {
      await tour.decreaseSlots(doc.startDate, doc.participants);
    }
  } catch (err) {
    console.error('❌ Lỗi khi giảm slot:', err.message);
  }
});

// MIDDLEWARE: Hoàn lại slot khi xóa booking
bookingSchema.pre('findOneAndDelete', async function(next) {
  this._deletedBooking = await this.model.findOne(this.getFilter());
  next();
});

bookingSchema.post('findOneAndDelete', async function() {
  if (this._deletedBooking) {
    try {
      const tour = await Tour.findById(this._deletedBooking.tour);
      if (tour) {
        await tour.increaseSlots(
          this._deletedBooking.startDate,
          this._deletedBooking.participants
        );
        console.log(
          `✅ Đã hoàn ${this._deletedBooking.participants} slot cho tour ${tour.name}`
        );
      }
    } catch (err) {
      console.error('❌ Lỗi khi hoàn slot:', err.message);
    }
  }
});

// MIDDLEWARE: Xử lý khi cập nhật booking
bookingSchema.pre('findOneAndUpdate', async function(next) {
  this._originalBooking = await this.model.findOne(this.getFilter());
  next();
});

bookingSchema.post('findOneAndUpdate', async function(doc) {
  if (this._originalBooking && doc) {
    const tour = await Tour.findById(doc.tour);
    if (!tour) return;

    try {
      const oldParticipants = this._originalBooking.participants;
      const newParticipants = doc.participants;
      const oldStartDate = this._originalBooking.startDate;
      const newStartDate = doc.startDate;

      if (oldStartDate.getTime() !== newStartDate.getTime()) {
        await tour.increaseSlots(oldStartDate, oldParticipants);
        await tour.decreaseSlots(newStartDate, newParticipants);
        console.log(
          `✅ Đã chuyển ${newParticipants} slot từ ${oldStartDate} sang ${newStartDate}`
        );
      } else if (oldParticipants !== newParticipants) {
        const difference = newParticipants - oldParticipants;
        if (difference > 0) {
          await tour.decreaseSlots(newStartDate, difference);
          console.log(`✅ Đã giảm thêm ${difference} slot`);
        } else {
          await tour.increaseSlots(newStartDate, Math.abs(difference));
          console.log(`✅ Đã hoàn ${Math.abs(difference)} slot`);
        }
      }
    } catch (err) {
      console.error('❌ Lỗi khi cập nhật slot:', err.message);
    }
  }
});

bookingSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'user',
    select: 'name email photo role'
  })
    .populate({
      path: 'tour',
      select:
        'name slug imageCover duration price startDates summary locations startLocation'
    })
    .populate({
      path: 'services.service',
      select: 'name price chargeType status'
    });
  next();
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
