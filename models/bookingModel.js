const mongoose = require('mongoose');

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
    require: [true, 'Booking phải có giá.']
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
  }
});

bookingSchema.index({ tour: 1 });
bookingSchema.index({ user: 1 });

bookingSchema.pre(/^find/, function(next) {
  this.populate('user').populate({
    path: 'tour',
    select: 'name duration'
  });
  next();
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
