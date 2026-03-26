const AppError = require('../utils/appError');

// ==================== XỬ LÝ LỖI TOÀN CỤC ====================

const LOGIN_REQUIRED_MESSAGE =
  'Bạn chưa đăng nhập! Vui lòng đăng nhập để có quyền truy cập.';

// Chuyển hướng về trang đăng nhập nếu lỗi là "chưa đăng nhập" (cho trang web)
const redirectToLoginIfNeeded = (err, req, res) => {
  if (
    err.message === LOGIN_REQUIRED_MESSAGE &&
    !req.originalUrl.startsWith('/api')
  ) {
    res.redirect('/login');
    return true;
  }
  return false;
};

// Xử lý lỗi CastError (ID MongoDB không hợp lệ)
const handleCastErrorDB = err => {
  const message = `Trường ${err.path} có giá trị không hợp lệ: ${err.value}.`;
  return new AppError(message, 400);
};

// Xử lý lỗi trùng giá trị unique (MongoDB duplicate key)
const handleDuplicateFieldsDB = err => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];

  const message = `Giá trị của trường bị trùng: ${value}. Vui lòng sử dụng giá trị khác!`;
  return new AppError(message, 400);
};

// Xử lý lỗi validation (dữ liệu đầu vào không hợp lệ)
const handleValidationErrorDB = err => {
  const errors = Object.values(err.errors).map(el => el.message);

  const message = `Dữ liệu đầu vào không hợp lệ. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// Xử lý lỗi JWT không hợp lệ
const handleJWTError = () =>
  new AppError('Token không hợp lệ. Vui lòng đăng nhập lại!', 401);

// Xử lý lỗi JWT hết hạn
const handleJWTExpiredError = () =>
  new AppError('Token của bạn đã hết hạn! Vui lòng đăng nhập lại.', 401);

// Gửi lỗi chi tiết (môi trường development)
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
  if (redirectToLoginIfNeeded(err, req, res)) return;
  return res.status(err.statusCode).render('error', {
    title: 'Đã xảy ra lỗi!',
    msg: err.message,
    statusCode: err.statusCode,
    status: err.status
  });
};

// Gửi lỗi rút gọn (môi trường production)
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
    if (redirectToLoginIfNeeded(err, req, res)) return;
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
  if (redirectToLoginIfNeeded(err, req, res)) return;
  return res.status(err.statusCode).render('error', {
    title: 'Đã xảy ra lỗi!',
    msg: 'Vui lòng thử lại sau.',
    statusCode: err.statusCode,
    status: err.status
  });
};

// Middleware xử lý lỗi toàn cục (Express error handler)
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
