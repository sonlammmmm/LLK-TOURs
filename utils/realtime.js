// Lưu instance Socket.IO dùng cho dashboard realtime
let ioInstance = null;

// Set io instance để emit sự kiện ở nơi khác
const setSocketServerInstance = io => {
  ioInstance = io;
};

// Emit event tới room admins, tránh crash nếu không có io
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
