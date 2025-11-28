const multer = require('multer');
const sharp = require('sharp');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

// Cấu hình multer
const MAX_PHOTO_SIZE_MB = 2;
const MAX_PHOTO_DIMENSION = 600;
const multerStorage = multer.memoryStorage();

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

exports.uploadUserPhoto = upload.single('photo');

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

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

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

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'Route này chưa được định nghĩa! Vui lòng sử dụng /signup'
  });
};

exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);

// KHÔNG cập nhật mật khẩu bằng cách này!
exports.updateUser = catchAsync(async (req, res, next) => {
  const updatePayload = { ...req.body };

  // X??- lA? tr?????ng h???p cA3 file ???nh
  if (req.file) {
    updatePayload.photo = req.file.filename;
  }

  // KhA'ng cho phA?p c??-p nh??-t m??-t kh??cu qua route admin
  ['password', 'passwordConfirm'].forEach(field => {
    if (field in updatePayload) delete updatePayload[field];
  });

  // ??A?nh d???u ?A?y lA? route qu???n lA? ???? khA'ng l???c ng?????i dA1ng khA'ng ho???t ???Tng
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

exports.deleteUser = factory.deleteOne(User);
