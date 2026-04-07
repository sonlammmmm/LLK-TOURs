const mongoose = require('mongoose');

const connectDatabase = async () => {
  const DB = process.env.DATABASE.replace(
    '<PASSWORD>',
    process.env.DATABASE_PASSWORD
  );

  try {
    await mongoose.connect(DB);
    console.log('Đã kết nối MongoDB thành công.');
  } catch (err) {
    console.error('Lỗi kết nối DB:', err);
  }
};

module.exports = { connectDatabase };
