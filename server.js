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

  // User register với userId của họ
  socket.on('register', ({ userId, role }) => {
    console.log('🧾 REGISTER payload:', { userId, role }); // <— thêm dòng này
    userSockets.set(userId, socket.id);
    socket.userId = userId;
    socket.userRole = role;
    socket.join(userId); // Join room = chính userId của họ
    console.log(
      `✅ User ${userId} (${role}) registered with socket ${socket.id}`
    );
  });

  // Admin join room của user để xem chat
  socket.on('joinUserRoom', ({ userId }) => {
    socket.join(userId);
    console.log(`✅ Admin joined room: ${userId}`);
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

    // Validation
    if (!senderId || !receiverId) {
      console.error('❌ Missing senderId or receiverId:', data);
      socket.emit('messageError', { error: 'Thiếu thông tin người gửi/nhận' });
      return;
    }

    if (!message || !message.trim()) {
      console.error('❌ Empty message');
      socket.emit('messageError', { error: 'Tin nhắn không được để trống' });
      return;
    }

    console.log('📨 Processing message:', {
      from: `${senderName} (${senderId})`,
      to: `${receiverName} (${receiverId})`,
      role: role
    });

    try {
      // Lưu vào database
      const savedMessage = await Message.create({
        sender: senderId,
        receiver: receiverId,
        senderName,
        receiverName,
        content: message,
        role
      });

      const messageData = {
        senderId,
        senderName,
        receiverId,
        receiverName,
        message,
        role,
        createdAt: savedMessage.createdAt
      };

      // Gửi cho người nhận (vào room của receiverId)
      io.to(receiverId).emit('newMessage', messageData);

      // Gửi cho người gửi (vào room của senderId)
      io.to(senderId).emit('newMessage', messageData);

      console.log(`✅ Message saved and sent successfully`);
    } catch (err) {
      console.error('❌ Lỗi khi lưu tin nhắn:', err.message);
      console.error('Data received:', data);
      socket.emit('messageError', { error: 'Không thể gửi tin nhắn' });
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      userSockets.delete(socket.userId);
      console.log(`🔴 User ${socket.userId} disconnected`);
    }
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
