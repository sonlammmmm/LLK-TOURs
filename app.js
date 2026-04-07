const path = require('path');
const express = require('express');

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
const faqRouter = require('./routes/faqRoutes');
const contactRouter = require('./routes/contactRoutes');
const siteSettingRouter = require('./routes/siteSettingRoutes');
const { loadMiddlewares } = require('./config/middlewares');

const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// 1) Middleware
loadMiddlewares(app);

// 3) ROUTES
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);
app.use('/api/v1/messages', messageRouter);
app.use('/api/v1/services', serviceRouter);
app.use('/api/v1/promotions', promotionRouter);
app.use('/api/v1/faqs', faqRouter);
app.use('/api/v1/contacts', contactRouter);
app.use('/api/v1/site-settings', siteSettingRouter);

// Bắt route không tồn tại
app.all('*', (req, res, next) => {
  next(new AppError(`Không tìm thấy ${req.originalUrl} trên server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
