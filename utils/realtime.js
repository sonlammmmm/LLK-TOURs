let ioInstance = null;

const setSocketServerInstance = io => {
  ioInstance = io;
};

const emitDashboardEvent = (eventName, payload) => {
  if (!ioInstance || !eventName) return;
  try {
    ioInstance.to('admins').emit(eventName, payload);
  } catch (err) {
    console.error('Unable to emit realtime event:', err.message);
  }
};

module.exports = {
  setSocketServerInstance,
  emitDashboardEvent
};
