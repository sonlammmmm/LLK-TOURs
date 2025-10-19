const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const Message = require('./models/messageModel');

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

// Map để theo dõi socket của từng user
const userSockets = new Map();

// -------------------- SOCKET.IO LOGIC --------------------
io.on('connection', socket => {
  console.log(`🟢 Client connected: ${socket.id}`);

  socket.on('register', ({ userId, role }) => {
    userSockets.set(userId, socket.id);
    socket.userId = userId;
    socket.userRole = role;
    socket.join(userId); // phòng riêng theo userId
    if (role === 'admin') socket.join('admins'); // phòng chung cho toàn bộ admin
    console.log(`✅ ${userId} (${role}) registered`);
  });

  socket.on('joinUserRoom', ({ userId }) => {
    socket.join(userId);
    console.log(`✅ Admin joined room: ${userId}`);
  });

  socket.on('chatMessage', async data => {
    try {
      const {
        senderId,
        senderName,
        receiverId,
        receiverName,
        message,
        role
      } = data;
      if (!senderId || !message || !message.trim()) {
        return socket.emit('messageError', { error: 'Thiếu dữ liệu' });
      }

      const convoUserId = role === 'user' ? senderId : receiverId;
      if (!convoUserId)
        return socket.emit('messageError', { error: 'Thiếu userId hội thoại' });

      const saved = await Message.create({
        sender: senderId,
        receiver: convoUserId,
        senderName,
        receiverName: receiverName || 'Admins',
        content: message,
        role
      });

      const payload = {
        _id: saved._id.toString(),
        senderId,
        senderName,
        receiverId: convoUserId,
        receiverName: receiverName || 'Admins',
        message,
        role,
        createdAt: saved.createdAt
      };

      // Phát 1 lần cho phòng user
      io.to(convoUserId).emit('newMessage', payload);

      // Nếu sender là admin, phát thêm về phòng riêng của admin (tùy nhu cầu)
      if (role === 'admin') io.to(senderId).emit('newMessage', payload);

      // Phát cho tất cả admin khi sender là user
      if (role === 'user') io.to('admins').emit('newMessage', payload);

      console.log('✅ message broadcasted');
    } catch (err) {
      console.error('❌ send error:', err);
      socket.emit('messageError', { error: 'Không thể gửi tin nhắn' });
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) userSockets.delete(socket.userId);
    console.log(`🔴 Client disconnected: ${socket.id}`);
  });
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
