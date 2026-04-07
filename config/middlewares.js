const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

const SiteSetting = require('../schemas/siteSettingModel');
const securityHeaders = require('./securityHeaders');

const shouldLoadSiteSettings = req => !req.originalUrl.startsWith('/api');

const loadMiddlewares = app => {
  // Tài nguyên vendor cho bundle front-end
  app.use(
    '/node_modules/axios/dist/esm',
    express.static(path.join(__dirname, '..', 'node_modules/axios/dist/esm'))
  );
  app.use(
    '/node_modules/@stripe/stripe-js/dist',
    express.static(
      path.join(__dirname, '..', 'node_modules/@stripe/stripe-js/dist')
    )
  );

  // Phục vụ các tệp tĩnh
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Cung cấp cấu hình runtime cho template
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

  // Tải thông tin cài đặt website cho footer
  app.use(async (req, res, next) => {
    try {
      if (shouldLoadSiteSettings(req)) {
        res.locals.siteSettings = await SiteSetting.getSettings();
      }
    } catch (err) {
      res.locals.siteSettings = null;
    }
    next();
  });

  // Thiết lập tiêu đề HTTP bảo mật
  app.use(helmet(securityHeaders.helmetOptions));
  app.use(helmet.contentSecurityPolicy(securityHeaders.cspOptions));

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
};

module.exports = { loadMiddlewares };
