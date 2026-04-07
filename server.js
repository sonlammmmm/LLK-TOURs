const http = require('http');
const dotenv = require('dotenv');
const { startSoftLockMaintenance } = require('./utils/bookingSoftLock');
const { setSocketServerInstance } = require('./utils/realtime');
const { initSocketServer } = require('./utils/socketServer');
const { connectDatabase } = require('./config/database');
const { registerProcessHandlers } = require('./config/processHandlers');

dotenv.config({ path: './config.env' });

const app = require('./app');

connectDatabase();

// HTTP + Socket.IO server
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
registerProcessHandlers(server);
startSoftLockMaintenance();

const io = initSocketServer(server);
setSocketServerInstance(io);

// Khởi động HTTP server
server.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
