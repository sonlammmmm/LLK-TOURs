const http = require('http');
const { promisify } = require('util');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const Message = require('./schemas/messageModel');
const User = require('./schemas/userModel');
const { startSoftLockMaintenance } = require('./utils/bookingSoftLock');
const { setSocketServerInstance } = require('./utils/realtime');

process.on('uncaughtException', err => {
  console.error('Lỗi không bắt được, đang dừng chương trình.');
  console.error(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });
const app = require('./app');

// Kết nối cơ sở dữ liệu
const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB)
  .then(() => {
    console.log('Đã kết nối MongoDB thành công.');
  })
  .catch(err => {
    console.error('Lỗi kết nối DB:', err);
  });

// HTTP + Socket.IO server
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
startSoftLockMaintenance();

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
setSocketServerInstance(io);

// Lấy token xác thực từ socket handshake
const getTokenFromSocket = socket => {
  const authHeader = socket.handshake.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  const authToken = socket.handshake.auth?.token;
  if (authToken) return authToken;

  const cookieHeader = socket.handshake.headers.cookie;
  if (!cookieHeader) return null;
  const jwtCookie = cookieHeader
    .split(';')
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith('jwt='));
  if (jwtCookie) {
    return jwtCookie
      .split('=')
      .slice(1)
      .join('=');
  }
  return null;
};

// Xác thực kết nối socket
io.use(async (socket, next) => {
  try {
    const token = getTokenFromSocket(socket);
    if (!token) {
      return next(new Error('Yêu cầu đăng nhập để sử dụng chat.'));
    }

    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new Error('Không tìm thấy người dùng đang kết nối socket.'));
    }

    socket.user = user;
    return next();
  } catch (err) {
    return next(new Error('Phiên chat không hợp lệ.'));
  }
});

// Tham gia phòng theo user/admin một lần mỗi kết nối
const registerSocket = socket => {
  if (!socket.user || socket.isRegistered) return;
  const actualUserId = socket.user.id.toString();
  socket.join(actualUserId);
  if (socket.user.role === 'admin') socket.join('admins');
  socket.isRegistered = true;
};

// Sự kiện chat realtime
io.on('connection', socket => {
  const emitMessageError = error => socket.emit('messageError', { error });
  registerSocket(socket);

  socket.on('register', ({ userId, role }) => {
    const actualUserId = socket.user.id.toString();
    const actualRole = socket.user.role;
    if (userId && userId !== actualUserId) {
      return emitMessageError('Thông tin đăng nhập socket không hợp lệ.');
    }
    if (role && role !== actualRole) {
      return emitMessageError('Vai trò socket không hợp lệ.');
    }
    registerSocket(socket);
  });

  socket.on('joinUserRoom', ({ userId }) => {
    if (socket.user.role !== 'admin') {
      return emitMessageError(
        'Chỉ admin mới được phép truy cập phòng người dùng.'
      );
    }
    if (!userId) {
      return emitMessageError('Thiếu userId phòng chat.');
    }
    socket.join(userId);
  });

  socket.on('chatMessage', async data => {
    try {
      registerSocket(socket);
      const actualSenderId = socket.user.id.toString();
      const { role } = socket.user;
      const message = (data?.message || '').trim();
      if (!message) {
        return emitMessageError('Thiếu dữ liệu.');
      }

      if (data.senderId && data.senderId !== actualSenderId) {
        return emitMessageError('Không thể giả mạo người gửi.');
      }

      if (data.role && data.role !== role) {
        return emitMessageError('Sai vai trò người gửi.');
      }

      const convoUserId = role === 'user' ? actualSenderId : data.receiverId;
      if (!convoUserId) {
        return emitMessageError('Thiếu thông tin người nhận để tạo hội thoại.');
      }

      let receiverName = 'Admins';
      if (role === 'admin') {
        const targetUser = await User.findById(convoUserId).select('name');
        if (!targetUser) {
          return emitMessageError('Không tìm thấy người dùng để chat.');
        }
        receiverName = targetUser.name;
      }

      const saved = await Message.create({
        sender: actualSenderId,
        receiver: convoUserId,
        senderName: socket.user.name,
        receiverName,
        content: message,
        role
      });

      const payload = {
        _id: saved._id.toString(),
        senderId: actualSenderId,
        senderName: socket.user.name,
        receiverId: convoUserId,
        receiverName,
        message,
        role,
        createdAt: saved.createdAt
      };

      io.to(convoUserId).emit('newMessage', payload);
      if (role === 'admin') io.to(actualSenderId).emit('newMessage', payload);
      if (role === 'user') io.to('admins').emit('newMessage', payload);
    } catch (err) {
      console.error('Lỗi gửi tin nhắn:', err);
      emitMessageError('Không thể gửi tin nhắn.');
    }
  });
});

// Khởi động HTTP server
server.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});

// Tắt ứng dụng an toàn khi lỗi bất đồng bộ
process.on('unhandledRejection', err => {
  console.error('Lỗi không xử lý được, đang dừng ứng dụng.');
  console.error(err.name, err.message);
  server.close(() => process.exit(1));
});
