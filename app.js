const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const viewRouter = require('./routes/viewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const messageRouter = require('./routes/messageRoutes');
const serviceRouter = require('./routes/serviceRoutes');
const promotionRouter = require('./routes/promotionRoutes');

const app = express();

app.use(
  '/node_modules/axios/dist/esm',
  express.static(path.join(__dirname, 'node_modules/axios/dist/esm'))
);
app.use(
  '/node_modules/@stripe/stripe-js/dist',
  express.static(path.join(__dirname, 'node_modules/@stripe/stripe-js/dist'))
);

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// 1) Middleware Toàn Cục
// Phục vụ các tệp tĩnh
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.locals.stripePublicKey = process.env.STRIPE_PUBLIC_KEY || '';
  res.locals.googleClientId = process.env.GOOGLE_CLIENT_ID || '';
  const momoAccessKey = process.env.MOMO_ACCESS_KEY || 'F8BBA842ECF85';
  const momoSecretKey =
    process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PD3vg6EkVlz';
  const momoPartnerCode = process.env.MOMO_PARTNER_CODE || 'MOMO';
  res.locals.momoPaymentEnabled = Boolean(
    momoAccessKey && momoSecretKey && momoPartnerCode
  );
  next();
});

// Thiết lập tiêu đề HTTP bảo mật
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
  })
);

app.use(
  helmet.contentSecurityPolicy({
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://js.stripe.com',
        'https://cdn.jsdelivr.net/npm/chart.js',
        'https://api.mapbox.com',
        'https://cdn.socket.io',
        'https://accounts.google.com',
        'https://apis.google.com',
        'https://www.gstatic.com'
      ],
      workerSrc: ["'self'", 'blob:', 'https://api.mapbox.com'],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://cdnjs.cloudflare.com',
        'https://api.mapbox.com'
      ],
      styleSrcElem: [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
        'https://cdnjs.cloudflare.com',
        'https://api.mapbox.com'
      ],
      fontSrc: [
        "'self'",
        'https://fonts.gstatic.com',
        'https://cdnjs.cloudflare.com'
      ],
      connectSrc: [
        "'self'",
        'ws://localhost:3000',
        'wss://localhost:3000',
        'https://api.mapbox.com',
        'https://js.stripe.com',
        'https://accounts.google.com',
        'https://oauth2.googleapis.com',
        'https://www.gstatic.com',
        'https://test-payment.momo.vn',
        'https://payment.momo.vn'
      ],
      imgSrc: [
        "'self'",
        'data:',
        'https://api.mapbox.com',
        'https://lh3.googleusercontent.com',
        'https://ssl.gstatic.com',
        'https://www.gstatic.com'
      ],
      frameSrc: [
        "'self'",
        'https://js.stripe.com',
        'https://accounts.google.com',
        'https://test-payment.momo.vn',
        'https://payment.momo.vn'
      ],
      navigateSrc: [
        "'self'",
        'https://checkout.stripe.com',
        'https://test-payment.momo.vn',
        'https://payment.momo.vn'
      ]
    }
  })
);

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Giới hạn số lượng yêu cầu từ cùng 1 API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour!',
  skip: req =>
    req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '10.0.2.2'
});
app.use('/api', limiter);

// Phân tích dữ liệu body, đọc dữ liệu từ body vào req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Làm sạch dữ liệu phòng chống chèn truy vấn NoSQL
app.use(mongoSanitize());

// Làm sạch dữ liệu phòng chống tấn công XSS (Cross-site Scripting)
app.use(xss());

// Ngăn chặn rối loạn tham số (parameter pollution)
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'price'
    ]
  })
);

// Middleware kiểm tra
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// 3) ROUTES
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);
app.use('/api/v1/messages', messageRouter);
app.use('/api/v1/services', serviceRouter);
app.use('/api/v1/promotions', promotionRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Không tìm thấy ${req.originalUrl} trên server!`, 404));
});

app.use((err, req, res, next) => {
  //  Log lỗi chi tiết
  if (err.statusCode === 400 || err.statusCode === 401) {
    console.error('🚫 Validation Error:', {
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      body: req.body,
      query: req.query,
      user: req.user?.id
    });
  }
  next(err);
});

app.use(globalErrorHandler);

module.exports = app;
