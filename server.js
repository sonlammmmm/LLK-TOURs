const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const Message = require('./models/messageModel'); // để lưu chat

// -------------------- XỬ LÝ LỖI NGOẠI LỆ ĐỒNG BỘ --------------------
process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION 💥 Tắt ứng dụng...');
  console.log(err.name, err.message);
  process.exit(1);
});

// -------------------- CẤU HÌNH ENV --------------------
dotenv.config({ path: './config.env' });
const app = require('./app');

// -------------------- KẾT NỐI DATABASE --------------------
const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB)
  .then(conn => {
    console.log('✅ Kết nối MongoDB thành công');
    console.log('Database:', conn.connection.name);
  })
  .catch(err => {
    console.error('❌ Lỗi kết nối DB:', err);
  });

// -------------------- KHỞI TẠO SERVER EXPRESS + SOCKET.IO --------------------
const port = process.env.PORT || 3000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// -------------------- SOCKET.IO LOGIC --------------------
io.on('connection', socket => {
  console.log(`🟢 Client connected: ${socket.id}`);

  // User join room riêng
  socket.on('joinRoom', ({ room }) => {
    socket.join(room);
    console.log(`✅ Joined room: ${room}`);
  });

  // Nhận và phát tin nhắn
  socket.on('chatMessage', async data => {
    const {
      senderId,
      senderName,
      receiverId,
      receiverName,
      message,
      role
    } = data;
    const room = receiverId;

    try {
      await Message.create({
        sender: senderId,
        receiver: receiverId,
        senderName,
        receiverName,
        content: message,
        role
      });
      io.to(room).emit('newMessage', data);
      io.to(senderId).emit('newMessage', data);
    } catch (err) {
      console.error('❌ Lỗi khi lưu tin nhắn:', err.message);
    }
  });

  socket.on('disconnect', () =>
    console.log(`🔴 Client disconnected: ${socket.id}`)
  );
});

// -------------------- KHỞI CHẠY SERVER --------------------
server.listen(port, () => {
  console.log(`🚀 Ứng dụng chạy tại http://localhost:${port}`);
});

// -------------------- XỬ LÝ PROMISE REJECTION --------------------
process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION 💥 Đang tắt ứng dụng...');
  console.log(err.name, err.message);
  server.close(() => process.exit(1));
});
