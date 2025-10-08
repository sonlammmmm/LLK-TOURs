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

const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// 1) Middleware Toàn Cục
// Phục vụ các tệp tĩnh
app.use(express.static(path.join(__dirname, 'public')));

// Thiết lập tiêu đề HTTP bảo mật
app.use(helmet());

app.use(
  helmet.contentSecurityPolicy({
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        'https://js.stripe.com',
        'https://cdn.jsdelivr.net/npm/chart.js',
        'https://api.mapbox.com'
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
        'ws://localhost:1234',
        'https://api.mapbox.com',
        'https://js.stripe.com'
      ],
      imgSrc: ["'self'", 'data:', 'https://api.mapbox.com'],
      frameSrc: ["'self'", 'https://js.stripe.com']
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
  message: 'Too many requests from this IP, please try again in an hour!'
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
  // console.log(req.cookies);
  next();
});

// 3) ROUTES
// Routes
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
