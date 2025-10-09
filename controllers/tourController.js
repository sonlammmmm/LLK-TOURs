const multer = require('multer');
const sharp = require('sharp');
const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');

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
  fileFilter: multerFilter
});

exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 }
]);

exports.resizeTourImages = catchAsync(async (req, res, next) => {
  if (!req.files) return next();

  // 1) Ảnh bìa
  if (req.files.imageCover) {
    req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
    await sharp(req.files.imageCover[0].buffer)
      .resize(2000, 1333)
      .toFormat('jpeg')
      .jpeg({ quality: 90 })
      .toFile(`public/img/tours/${req.body.imageCover}`);
  }

  // 2) Các ảnh khác
  if (req.files.images) {
    req.body.images = [];

    await Promise.all(
      req.files.images.map(async (file, i) => {
        const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;

        await sharp(file.buffer)
          .resize(2000, 1333)
          .toFormat('jpeg')
          .jpeg({ quality: 90 })
          .toFile(`public/img/tours/${filename}`);

        req.body.images.push(filename);
      })
    );
  }

  // Xử lý trường startLocation từ form
  if (req.body.startLocation && typeof req.body.startLocation === 'string') {
    req.body.startLocation = JSON.parse(req.body.startLocation);
  }

  next();
});

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary';
  next();
};

exports.normalizeMultipartJSON = (req, res, next) => {
  // 1) Parse các field JSON gửi qua multipart
  const parseJSON = key => {
    if (typeof req.body[key] === 'string') {
      try {
        req.body[key] = JSON.parse(req.body[key]);
      } catch (e) {
        // Giữ nguyên nếu không parse được
      }
    }
  };

  parseJSON('startDates');
  parseJSON('startLocation');
  parseJSON('locations');

  // 2) Chuẩn hoá startDates về dạng [{ date, availableSlots }]
  if (Array.isArray(req.body.startDates)) {
    req.body.startDates = req.body.startDates.map(d => {
      if (typeof d === 'string') {
        return {
          date: new Date(d),
          availableSlots: Number(req.body.maxGroupSize) || 0
        };
      }
      return {
        date: new Date(d.date || d),
        availableSlots:
          Number(
            d.availableSlots != null ? d.availableSlots : req.body.maxGroupSize
          ) || 0
      };
    });
  } else if (typeof req.body.startDates === 'string') {
    // Trường hợp đặc biệt: vẫn còn là chuỗi JSON
    try {
      const arr = JSON.parse(req.body.startDates);
      req.body.startDates = arr.map(d => ({
        date: new Date(d.date || d),
        availableSlots:
          Number(
            d.availableSlots != null ? d.availableSlots : req.body.maxGroupSize
          ) || 0
      }));
    } catch {
      // để Mongoose báo lỗi nếu dữ liệu sai
    }
  }

  next();
};

exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);
exports.createTour = catchAsync(async (req, res, next) => {
  // ====== 1️⃣ Xử lý các field JSON được gửi từ FormData ======

  // START DATES
  if (typeof req.body.startDates === 'string') {
    try {
      const arr = JSON.parse(req.body.startDates);
      if (Array.isArray(arr)) {
        req.body.startDates = arr.map(d => ({
          date: new Date(d.date || d),
          availableSlots:
            Number(
              d.availableSlots != null
                ? d.availableSlots
                : req.body.maxGroupSize
            ) || 0
        }));
      }
    } catch (err) {
      console.warn('⚠️ Không parse được startDates:', req.body.startDates);
      req.body.startDates = [];
    }
  }

  // START LOCATION
  if (typeof req.body.startLocation === 'string') {
    try {
      req.body.startLocation = JSON.parse(req.body.startLocation);
    } catch (err) {
      console.warn(
        '⚠️ Không parse được startLocation:',
        req.body.startLocation
      );
      req.body.startLocation = undefined;
    }
  }

  // LOCATIONS
  if (typeof req.body.locations === 'string') {
    try {
      req.body.locations = JSON.parse(req.body.locations);
    } catch (err) {
      console.warn('⚠️ Không parse được locations:', req.body.locations);
      req.body.locations = [];
    }
  }

  // GUIDES (nếu gửi nhiều ID)
  if (typeof req.body.guides === 'string') {
    req.body.guides = [req.body.guides];
  }

  // ====== 2️⃣ Kiểm tra và ép kiểu bổ sung ======

  // Đảm bảo maxGroupSize là số
  if (req.body.maxGroupSize) {
    req.body.maxGroupSize = Number(req.body.maxGroupSize);
  }

  // Đảm bảo duration, price, priceDiscount là số
  ['duration', 'price', 'priceDiscount'].forEach(f => {
    if (req.body[f]) req.body[f] = Number(req.body[f]);
  });

  // ====== 3️⃣ Ghi log để debug (nếu cần) ======
  console.log('✅ Dữ liệu tạo tour sau khi xử lý:', {
    name: req.body.name,
    startDates: req.body.startDates,
    startLocation: req.body.startLocation,
    locations: req.body.locations,
    guides: req.body.guides
  });

  // ====== 4️⃣ Tạo tour ======
  const newTour = await Tour.create(req.body);

  res.status(201).json({
    status: 'success',
    data: { tour: newTour }
  });
});

exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  if (!lat || !lng) {
    next(
      new AppError(
        'Vui lòng cung cấp vĩ độ và kinh độ theo định dạng lat,lng.',
        400
      )
    );
  }

  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } }
  });

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      data: tours
    }
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  if (!lat || !lng) {
    next(
      new AppError(
        'Vui lòng cung cấp vĩ độ và kinh độ theo định dạng lat,lng.',
        400
      )
    );
  }

  const distances = await Tour.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1]
        },
        distanceField: 'distance',
        distanceMultiplier: multiplier
      }
    },
    {
      $project: {
        distance: 1,
        name: 1
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      data: distances
    }
  });
});
