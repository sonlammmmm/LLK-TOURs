const registerProcessHandlers = server => {
  process.on('uncaughtException', err => {
    console.error('Lỗi không bắt được, đang dừng chương trình.');
    console.error(err.name, err.message);
    process.exit(1);
  });

  process.on('unhandledRejection', err => {
    console.error('Lỗi không xử lý được, đang dừng ứng dụng.');
    console.error(err.name, err.message);
    if (server && server.close) {
      server.close(() => process.exit(1));
      return;
    }
    process.exit(1);
  });
};

module.exports = { registerProcessHandlers };
