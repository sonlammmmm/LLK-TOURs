const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const Message = require('./models/messageModel');
const User = require('./models/userModel');
const { startSoftLockMaintenance } = require('./utils/bookingSoftLock');

process.on('uncaughtException', err => {
  console.error('Lỗi không bắt được, đang dừng chương trình.');
  console.error(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './config.env' });
const app = require('./app');

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

const port = process.env.PORT || 3000;
const server = http.createServer(app);
startSoftLockMaintenance();

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
// Map socket theo từng user
const userSockets = new Map();

const getTokenFromSocket = socket => {
  const authHeader = socket.handshake.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  if (socket.handshake.auth && socket.handshake.auth.token) {
    return socket.handshake.auth.token;
  }

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

const registerSocket = socket => {
  if (!socket.user || socket.isRegistered) return;
  const actualUserId = socket.user.id.toString();
  userSockets.set(actualUserId, socket.id);
  socket.join(actualUserId);
  if (socket.user.role === 'admin') socket.join('admins');
  socket.isRegistered = true;
};

io.on('connection', socket => {
  registerSocket(socket);

  socket.on('register', ({ userId, role }) => {
    const actualUserId = socket.user.id.toString();
    const actualRole = socket.user.role;
    if (userId && userId !== actualUserId) {
      return socket.emit('messageError', {
        error: 'Thông tin đăng nhập socket không hợp lệ.'
      });
    }
    if (role && role !== actualRole) {
      return socket.emit('messageError', {
        error: 'Vai trò socket không hợp lệ.'
      });
    }
    registerSocket(socket);
  });

  socket.on('joinUserRoom', ({ userId }) => {
    if (socket.user.role !== 'admin') {
      return socket.emit('messageError', {
        error: 'Chỉ admin mới được phép truy cập phòng người dùng.'
      });
    }
    if (!userId) {
      return socket.emit('messageError', { error: 'Thiếu userId phòng chat.' });
    }
    socket.join(userId);
  });

  socket.on('chatMessage', async data => {
    try {
      registerSocket(socket);
      const actualSenderId = socket.user.id.toString();
      const { role } = socket.user;
      const message = (data.message || '').trim();
      if (!message) {
        return socket.emit('messageError', { error: 'Thiếu dữ liệu.' });
      }

      if (data.senderId && data.senderId !== actualSenderId) {
        return socket.emit('messageError', {
          error: 'Không thể giả mạo người gửi.'
        });
      }

      if (data.role && data.role !== role) {
        return socket.emit('messageError', { error: 'Sai vai trò người gửi.' });
      }

      const convoUserId = role === 'user' ? actualSenderId : data.receiverId;
      if (!convoUserId) {
        return socket.emit('messageError', {
          error: 'Thiếu thông tin người nhận để tạo hội thoại.'
        });
      }

      let receiverName = 'Admins';
      if (role === 'admin') {
        const targetUser = await User.findById(convoUserId).select('name');
        if (!targetUser) {
          return socket.emit('messageError', {
            error: 'Không tìm thấy người dùng để chat.'
          });
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
      socket.emit('messageError', { error: 'Không thể gửi tin nhắn.' });
    }
  });

  socket.on('disconnect', () => {
    if (socket.user && socket.user.id) {
      userSockets.delete(socket.user.id.toString());
    }
  });
});

server.listen(port, () => {
  console.log(`Server đang chạy tại http://localhost:${port}`);
});

process.on('unhandledRejection', err => {
  console.error('Lỗi không xử lý được, đang dừng ứng dụng.');
  console.error(err.name, err.message);
  server.close(() => process.exit(1));
});
