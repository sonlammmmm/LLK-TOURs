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
    enum: ['stripe', 'vnpay'],
    default: 'stripe'
  }
});

bookingSchema.index({ tour: 1 });
bookingSchema.index({ user: 1 });

// MIDDLEWARE: Giảm slot khi tạo booking
bookingSchema.post('save', async doc => {
  try {
    const tour = await Tour.findById(doc.tour);
    if (tour) {
      await tour.decreaseSlots(doc.startDate, doc.participants);
      console.log(
        `Đã giảm ${doc.participants} slot cho tour ${tour.name} ngày ${doc.startDate}`
      );
    }
  } catch (err) {
    console.error('❌ Lỗi khi giảm slot:', err.message);
    // Có thể rollback booking ở đây nếu cần
  }
});

// MIDDLEWARE: Hoàn lại slot khi xóa booking
bookingSchema.pre('findOneAndDelete', async function(next) {
  // Lưu booking trước khi xóa để có thể hoàn slot
  this._deletedBooking = await this.model.findOne(this.getFilter());
  next();
});

// eslint-disable-next-line no-unused-vars
bookingSchema.post('findOneAndDelete', async function(_doc) {
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

// MIDDLEWARE: Xử lý khi cập nhật booking (thay đổi số người hoặc ngày)
bookingSchema.pre('findOneAndUpdate', async function(next) {
  // Lưu booking cũ
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

      // Nếu đổi ngày khởi hành
      if (oldStartDate.getTime() !== newStartDate.getTime()) {
        // Hoàn slot cho ngày cũ
        await tour.increaseSlots(oldStartDate, oldParticipants);
        // Trừ slot cho ngày mới
        await tour.decreaseSlots(newStartDate, newParticipants);
        console.log(
          `✅ Đã chuyển ${newParticipants} slot từ ${oldStartDate} sang ${newStartDate}`
        );
      }
      // Nếu chỉ đổi số người
      else if (oldParticipants !== newParticipants) {
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
  this.populate('user').populate({
    path: 'tour',
    select: 'name duration'
  });
  next();
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
