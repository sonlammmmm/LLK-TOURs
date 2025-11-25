const BookingHold = require('../models/bookingHoldModel');
const Tour = require('../models/tourModel');

const DEFAULT_HOLD_MS =
  Math.max(
    Number(process.env.BOOKING_SOFT_LOCK_DURATION_MS) || 10 * 60 * 1000,
    60 * 1000
  ) || 10 * 60 * 1000;
const SESSION_EXTENSION_MS =
  Number(process.env.BOOKING_SOFT_LOCK_EXTENSION_MS) || 5 * 60 * 1000;
const SWEEP_INTERVAL_MS =
  Number(process.env.BOOKING_SOFT_LOCK_SWEEP_MS) || 30 * 1000;
const SWEEP_BATCH_SIZE =
  Number(process.env.BOOKING_SOFT_LOCK_SWEEP_BATCH) || 50;

const buildStartKey = date => new Date(date).toISOString().split('T')[0] || '';

const getDayRange = dateValue => {
  const base = new Date(dateValue);
  if (Number.isNaN(base.getTime())) return null;
  const start = new Date(base);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

const updateSlots = async (tourId, startDate, delta, filterByAvailability) => {
  const dayRange = getDayRange(startDate);
  if (!dayRange) return null;

  const baseFilter = {
    _id: tourId,
    startDates: {
      $elemMatch: {
        date: { $gte: dayRange.start, $lt: dayRange.end }
      }
    }
  };

  if (filterByAvailability) {
    baseFilter.startDates.$elemMatch.availableSlots = { $gte: delta * -1 };
  }

  return Tour.updateOne(baseFilter, {
    $inc: { 'startDates.$.availableSlots': delta }
  });
};

const decreaseSlots = (tourId, startDate, participants) =>
  updateSlots(tourId, startDate, -participants, true);

const increaseSlots = (tourId, startDate, participants) =>
  updateSlots(tourId, startDate, participants, false);

const acquireSoftLock = async ({
  tourId,
  userId,
  startDate,
  participants,
  platform = 'web',
  servicesSnapshot = []
}) => {
  if (!tourId || !userId || !startDate) {
    throw new Error('Missing data for soft lock acquisition');
  }
  const normalizedStart = new Date(startDate);
  if (Number.isNaN(normalizedStart.getTime())) {
    throw new Error('Invalid start date for soft lock');
  }

  const seats = Math.max(parseInt(participants, 10) || 1, 1);
  const decreaseResult = await decreaseSlots(tourId, normalizedStart, seats);

  if (!decreaseResult || decreaseResult.modifiedCount === 0) {
    return {
      success: false,
      code: 'not-enough-slots',
      message: 'Lịch khởi hành này đã được giữ hết chỗ, vui lòng thử lại.'
    };
  }

  try {
    const expiresAt = new Date(Date.now() + DEFAULT_HOLD_MS);
    const hold = await BookingHold.create({
      tour: tourId,
      user: userId,
      startDate: normalizedStart,
      startDateKey: buildStartKey(normalizedStart),
      participants: seats,
      platform,
      servicesSnapshot,
      expiresAt
    });
    return { success: true, hold };
  } catch (err) {
    await increaseSlots(tourId, normalizedStart, seats);
    throw err;
  }
};

const releaseSoftLock = async (holdOrId, reason = 'cancelled') => {
  let holdDoc = holdOrId;
  if (!holdDoc || !holdDoc._id) {
    holdDoc = await BookingHold.findById(holdOrId);
  }
  if (!holdDoc || holdDoc.status !== 'active') return null;

  await increaseSlots(holdDoc.tour, holdDoc.startDate, holdDoc.participants);

  holdDoc.status = reason === 'expired' ? 'expired' : 'released';
  holdDoc.releaseReason = reason;
  holdDoc.releasedAt = new Date();
  await holdDoc.save();
  return holdDoc;
};

const confirmSoftLock = async (holdId, bookingId) => {
  if (!holdId) return null;
  const hold = await BookingHold.findById(holdId);
  if (!hold || hold.status !== 'active') return null;

  hold.status = 'confirmed';
  hold.confirmedAt = new Date();
  hold.booking = bookingId || hold.booking;
  await hold.save();
  return hold;
};

const linkSessionToSoftLock = async (holdId, sessionId) => {
  if (!holdId || !sessionId) return null;
  const hold = await BookingHold.findById(holdId);
  if (!hold || hold.status !== 'active') return hold;

  hold.sessionId = sessionId;
  const extendedExpiry = new Date(Date.now() + SESSION_EXTENSION_MS);
  if (!hold.expiresAt || hold.expiresAt < extendedExpiry) {
    hold.expiresAt = extendedExpiry;
  }
  await hold.save();
  return hold;
};

const findActiveSoftLockBySession = sessionId => {
  if (!sessionId) return null;
  return BookingHold.findOne({
    sessionId,
    status: 'active'
  });
};

const releaseSoftLockBySession = async (sessionId, reason = 'cancelled') => {
  const hold = await findActiveSoftLockBySession(sessionId);
  if (!hold) return null;
  return releaseSoftLock(hold, reason);
};

const getSoftLockById = softLockId => {
  if (!softLockId) return null;
  return BookingHold.findById(softLockId);
};

const sweepExpiredSoftLocks = async () => {
  const now = new Date();

  const batch = await BookingHold.find({
    status: 'active',
    expiresAt: { $lte: now }
  })
    .sort({ expiresAt: 1 })
    .limit(SWEEP_BATCH_SIZE);

  if (!batch.length) return 0;

  const releasePromises = batch.map(hold => releaseSoftLock(hold, 'expired'));
  const releasedHolds = await Promise.allSettled(releasePromises);

  return releasedHolds.length;
};

let sweepIntervalId = null;

const startSoftLockMaintenance = () => {
  if (sweepIntervalId) return sweepIntervalId;

  sweepIntervalId = setInterval(async () => {
    try {
      const released = await sweepExpiredSoftLocks();
      if (released > 0) {
        console.log(`[SoftLock] Released ${released} expired holds`);
      }
    } catch (err) {
      console.error('[SoftLock] Sweep error:', err.message);
    }
  }, SWEEP_INTERVAL_MS);

  if (typeof sweepIntervalId.unref === 'function') {
    sweepIntervalId.unref();
  }

  return sweepIntervalId;
};

module.exports = {
  acquireSoftLock,
  releaseSoftLock,
  releaseSoftLockBySession,
  confirmSoftLock,
  linkSessionToSoftLock,
  findActiveSoftLockBySession,
  getSoftLockById,
  sweepExpiredSoftLocks,
  startSoftLockMaintenance
};
