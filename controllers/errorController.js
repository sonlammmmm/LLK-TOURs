const AppError = require('../utils/appError');

const handleCastErrorDB = err => {
  const message = `Trường ${err.path} có giá trị không hợp lệ: ${err.value}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = err => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];

  const message = `Giá trị của trường bị trùng: ${value}. Vui lòng sử dụng giá trị khác!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = err => {
  const errors = Object.values(err.errors).map(el => el.message);

  const message = `Dữ liệu đầu vào không hợp lệ. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Token không hợp lệ. Vui lòng đăng nhập lại!', 401);

const handleJWTExpiredError = () =>
  new AppError('Token của bạn đã hết hạn! Vui lòng đăng nhập lại.', 401);

const sendErrorDev = (err, req, res) => {
  // A) API (phục vụ API)
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  }

  // B) TRANG WEB HIỂN THỊ
  console.error('LỖI', err);
  return res.status(err.statusCode).render('error', {
    title: 'Đã xảy ra lỗi!',
    msg: err.message,
    statusCode: err.statusCode,
    status: err.status
  });
};

const sendErrorProd = (err, req, res) => {
  // A) API (phục vụ API)
  if (req.originalUrl.startsWith('/api')) {
    // A) Lỗi có thể dự đoán, đáng tin cậy: gửi thông báo cho khách hàng
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
    }
    // B) Lỗi lập trình hoặc lỗi chưa xác định: không tiết lộ chi tiết lỗi
    // 1) Ghi log lỗi
    console.error('LỖI', err);
    // 2) Gửi thông báo chung
    return res.status(500).json({
      status: 'error',
      message: 'Đã xảy ra lỗi nghiêm trọng!'
    });
  }

  // B) TRANG WEB HIỂN THỊ
  // A) Lỗi có thể dự đoán, đáng tin cậy: gửi thông báo cho khách hàng
  if (err.isOperational) {
    console.log(err);
    return res.status(err.statusCode).render('error', {
      title: 'Đã xảy ra lỗi!',
      msg: err.message,
      statusCode: err.statusCode,
      status: err.status
    });
  }
  // B) Lỗi lập trình hoặc lỗi chưa xác định: không tiết lộ chi tiết lỗi
  // 1) Ghi log lỗi
  console.error('LỖI', err);
  // 2) Gửi thông báo chung
  return res.status(err.statusCode).render('error', {
    title: 'Đã xảy ra lỗi!',
    msg: 'Vui lòng thử lại sau.',
    statusCode: err.statusCode,
    status: err.status
  });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;

    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError')
      error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, req, res);
  }
};
