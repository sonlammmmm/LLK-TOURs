const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Email = require('../utils/email');

const signToken = id =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);

  res.cookie('jwt', token, {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https'
  });

  // Xóa trường mật khẩu khỏi kết quả trả về
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm
  });

  const url = `${req.protocol}://${req.get('host')}/me`;
  await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Kiểm tra xem email và mật khẩu có được cung cấp không
  if (!email || !password) {
    return next(new AppError('Vui lòng cung cấp email và mật khẩu!', 400));
  }
  // 2) Kiểm tra xem người dùng có tồn tại và mật khẩu có đúng không
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Email hoặc mật khẩu không chính xác', 401));
  }

  // 3) Nếu mọi thứ ổn, gửi token cho khách hàng
  createSendToken(user, 200, req, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Lấy token và kiểm tra xem nó có tồn tại không
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError(
        'Bạn chưa đăng nhập! Vui lòng đăng nhập để có quyền truy cập.',
        401
      )
    );
  }

  // 2) Xác thực token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Kiểm tra xem người dùng có tồn tại không
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError('Người dùng liên kết với token này không còn tồn tại.', 401)
    );
  }

  // 4) Kiểm tra xem người dùng có thay đổi mật khẩu sau khi token được phát hành không
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        'Người dùng vừa mới thay đổi mật khẩu! Vui lòng đăng nhập lại.',
        401
      )
    );
  }

  // Cấp quyền truy cập cho route được bảo vệ
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// Chỉ dành cho trang hiển thị (rendered pages), không báo lỗi!
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) Xác thực token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 2) Kiểm tra xem người dùng có còn tồn tại không
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 3) Kiểm tra xem người dùng có thay đổi mật khẩu sau khi token được tạo không
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // Có người dùng đã đăng nhập
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

exports.restrictTo = (...roles) => (req, res, next) => {
  // Ví dụ: roles ['admin', 'lead-guide'], hiện tại role của người dùng là 'user'
  if (!roles.includes(req.user.role)) {
    return next(
      new AppError('Bạn không có quyền thực hiện hành động này', 403)
    );
  }

  next();
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Lấy user dựa trên email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('Không tìm thấy người dùng với email này', 404));
  }

  // 2) Tạo token đặt lại mật khẩu ngẫu nhiên
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Gửi email
  try {
    // Tạo URL đặt lại mật khẩu đầy đủ - URL này sẽ dẫn đến trang web, không phải API
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/reset-password/${resetToken}`;

    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token đã được gửi đến email!'
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError('Có lỗi khi gửi email. Vui lòng thử lại sau!', 500)
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Lấy user dựa trên token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  // 2) Nếu token chưa hết hạn và có user, đặt mật khẩu mới
  if (!user) {
    return next(new AppError('Token không hợp lệ hoặc đã hết hạn', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 4) Đăng nhập user, gửi JWT
  createSendToken(user, 200, req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Lấy user từ collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Kiểm tra xem mật khẩu hiện tại có chính xác hay không
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Mật khẩu hiện tại không đúng.', 401));
  }

  // 3) Nếu chính xác, cập nhật mật khẩu
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate sẽ không hoạt động đúng cách!

  // 4) Đăng nhập user, gửi JWT
  createSendToken(user, 200, req, res);
});
