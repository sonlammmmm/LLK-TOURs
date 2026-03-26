const multer = require('multer');
const sharp = require('sharp');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

// ==================== CẤU HÌNH UPLOAD AVATAR ====================

// Giới hạn kích thước ảnh upload (MB) và kích thước resize (px)
const MAX_PHOTO_SIZE_MB = 2;
const MAX_PHOTO_DIMENSION = 600;
// Lưu ảnh vào bộ nhớ tạm (buffer) để xử lý bằng Sharp
const multerStorage = multer.memoryStorage();

// Bộ lọc: chỉ cho phép file ảnh
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(
      new AppError('Không phải là ảnh! Vui lòng chỉ tải lên hình ảnh.', 400),
      false
    );
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: MAX_PHOTO_SIZE_MB * 1024 * 1024 }
});

// Middleware upload 1 ảnh đại diện
exports.uploadUserPhoto = upload.single('photo');

// Resize ảnh đại diện về 600×600, crop giữa, chuyển sang JPEG chất lượng 85
exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(MAX_PHOTO_DIMENSION, MAX_PHOTO_DIMENSION, {
      fit: 'cover',
      position: 'center',
      withoutEnlargement: true
    })
    .toFormat('jpeg')
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(`public/img/users/${req.file.filename}`);

  next();
});

// Helper: chỉ giữ lại các field được phép cập nhật
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

// ==================== USER TỰ QUẢN LÝ TÀI KHOẢN ====================

// Middleware: gán id của user đang đăng nhập vào params (dùng với getOne)
exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

// Cập nhật thông tin cá nhân (name, email, photo) — KHÔNG cho đổi password
exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Tạo lỗi nếu người dùng gửi dữ liệu mật khẩu
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'Route này không dành cho cập nhật mật khẩu. Vui lòng sử dụng /updateMyPassword.',
        400
      )
    );
  }

  // 2) Lọc ra các trường không được phép cập nhật
  const filteredBody = filterObj(req.body, 'name', 'email');
  if (req.file) filteredBody.photo = req.file.filename;

  // 3) Cập nhật tài liệu người dùng
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

// Vô hiệu hoá tài khoản (soft delete: active = false)
exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// ==================== ADMIN QUẢN LÝ USER ====================

// Placeholder: không cho tạo user qua route này, dùng /signup
exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'Route này chưa được định nghĩa! Vui lòng sử dụng /signup'
  });
};

// Lấy chi tiết 1 user
exports.getUser = factory.getOne(User);
// Lấy tất cả user (admin)
exports.getAllUsers = factory.getAll(User);

// Admin cập nhật user (bỏ qua password/passwordConfirm, hỗ trợ upload ảnh)
// KHÔNG cập nhật mật khẩu bằng cách này!
exports.updateUser = catchAsync(async (req, res, next) => {
  const updatePayload = { ...req.body };

  if (req.file) {
    updatePayload.photo = req.file.filename;
  }

  ['password', 'passwordConfirm'].forEach(field => {
    if (field in updatePayload) delete updatePayload[field];
  });

  const query = User.findByIdAndUpdate(req.params.id, updatePayload, {
    new: true,
    runValidators: true
  });
  query._adminRoute = true;

  const updatedUser = await query;

  if (!updatedUser) {
    return next(new AppError('Không tìm thấy người dùng với ID này', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

// Admin kích hoạt lại tài khoản đã bị vô hiệu hoá
// Dành cho admin
exports.activateUser = catchAsync(async (req, res, next) => {
  // Sử dụng findOneAndUpdate với điều kiện _id và active: false
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, active: false },
    { active: true },
    { new: true }
  );

  if (!user) {
    return next(
      new AppError(
        'Không tìm thấy người dùng hoặc người dùng đã được kích hoạt',
        404
      )
    );
  }

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

// Xóa user (hard delete)
exports.deleteUser = factory.deleteOne(User);
