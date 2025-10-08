const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Xử lý các ngoại lệ chưa được xử lý (lỗi đồng bộ)
process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION! 💥 Đang tắt ứng dụng...');
  console.log(err.name, err.message);
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
  .then(conn => {
    console.log('Kết nối DB thành công');
    console.log('Đã kết nối với DB:', conn.connection.name);
  })
  .catch(err => {
    console.error('Lỗi kết nối DB:', err);
  });

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Ứng dụng đang chạy trên cổng ${port}...`);
});

// Xử lý các lỗi Promise chưa được xử lý (lỗi bất đồng bộ)
process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION! 💥 Đang tắt ứng dụng...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
