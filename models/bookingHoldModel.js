const mongoose = require('mongoose');

const bookingHoldSchema = new mongoose.Schema(
  {
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    startDate: {
      type: Date,
      required: true
    },
    startDateKey: {
      type: String,
      required: true,
      index: true
    },
    participants: {
      type: Number,
      required: true,
      min: [1, 'Booking hold phải giữ tối thiểu 1 khách']
    },
    platform: {
      type: String,
      default: 'web'
    },
    servicesSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: []
    },
    status: {
      type: String,
      enum: ['active', 'confirmed', 'released', 'cancelled', 'expired'],
      default: 'active',
      index: true
    },
    sessionId: {
      type: String,
      unique: true,
      sparse: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    confirmedAt: Date,
    releasedAt: Date,
    releaseReason: String,
    booking: {
      type: mongoose.Schema.ObjectId,
      ref: 'Booking'
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

bookingHoldSchema.index({ tour: 1, startDateKey: 1, status: 1 });
bookingHoldSchema.index({ user: 1, status: 1 });

const BookingHold = mongoose.model('BookingHold', bookingHoldSchema);

module.exports = BookingHold;
