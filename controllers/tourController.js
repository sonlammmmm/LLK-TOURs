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

const tryParseJSON = (str, fieldName = 'payload') => {
  try {
    return JSON.parse(str);
  } catch (err) {
    console.warn(
      `⚠️ Invalid JSON for "${fieldName}":`,
      str,
      '| error:',
      err.message
    );
    return undefined;
  }
};

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
      const date = d?.date ?? d;
      const out = { date: new Date(date) };
      if (d && d.availableSlots != null) {
        out.availableSlots = Number(d.availableSlots);
      }
      return out;
    });
  } else if (typeof req.body.startDates === 'string') {
    // Trường hợp đặc biệt: vẫn còn là chuỗi JSON
    try {
      const arr = JSON.parse(req.body.startDates);
      req.body.startDates = arr.map(d => {
        const out = { date: new Date(d.date || d) };
        if (d && d.availableSlots != null) {
          out.availableSlots = Number(d.availableSlots);
        } else if (req.method === 'POST') {
          // ✅ Chỉ default khi CREATE
          out.availableSlots = Number(req.body.maxGroupSize) || 0;
        }
        return out;
      });
    } catch (e) {
      // để Mongoose/validator phía sau xử lý nếu dữ liệu sai
    }
  }

  next();
};

exports.getAllTours = factory.getAll(Tour);

exports.getTour = factory.getOne(Tour, { path: 'reviews' });

exports.updateTour = catchAsync(async (req, res, next) => {
  const current = await Tour.findById(req.params.id);
  if (!current) return next(new AppError('Không tìm thấy tour', 404));

  const appendStartDates =
    req.body.appendStartDates === true ||
    req.body.appendStartDates === 'true';
  delete req.body.appendStartDates;

  // Ép kiểu số nếu có trong payload
  ['maxGroupSize', 'duration', 'price', 'priceDiscount'].forEach(f => {
    if (req.body[f] != null) req.body[f] = Number(req.body[f]);
  });

  // ✅ Parse an toàn nếu client gửi JSON string
  if (typeof req.body.startLocation === 'string') {
    const parsed = tryParseJSON(req.body.startLocation, 'startLocation');
    if (parsed) req.body.startLocation = parsed;
    else delete req.body.startLocation; // không làm hỏng dữ liệu cũ
  }
  if (typeof req.body.locations === 'string') {
    const parsed = tryParseJSON(req.body.locations, 'locations');
    if (parsed) req.body.locations = parsed;
    else delete req.body.locations;
  }
  if (typeof req.body.guides === 'string') {
    const parsed = tryParseJSON(req.body.guides, 'guides');
    if (parsed) req.body.guides = parsed;
    else delete req.body.guides;
  }

  // ------------------------
  // Merge hoặc thay thế startDates tuỳ mode
  let incoming = req.body.startDates;
  if (typeof incoming === 'string') {
    incoming = tryParseJSON(incoming, 'startDates');
    // nếu parse lỗi → incoming = undefined (không đụng tới startDates hiện có)
  }

  if (Array.isArray(incoming)) {
    const toKey = dateVal => dateVal.toISOString().split('T')[0];
    const existingMap = new Map(
      (current.startDates || []).map(d => {
        const dateInstance = new Date(d.date);
        return [
          toKey(dateInstance),
          {
            date: dateInstance,
            availableSlots: Math.max(0, Number(d.availableSlots) || 0)
          }
        ];
      })
    );
    const normalizedEntries = [];

    incoming.forEach(d => {
      const raw = d && d.date != null ? d.date : d;
      const dateVal = new Date(raw);
      if (!raw || Number.isNaN(dateVal.getTime())) return;
      const key = toKey(dateVal);
      const prev = existingMap.get(key);

      let slots;
      if (d && d.availableSlots != null) {
        slots = Number(d.availableSlots);
      } else if (prev) {
        slots = prev.availableSlots;
      } else {
        const mg =
          req.body.maxGroupSize != null
            ? Number(req.body.maxGroupSize)
            : Number(current.maxGroupSize);
        slots = Number.isFinite(mg) ? mg : 0;
      }

      normalizedEntries.push([
        key,
        {
          date: dateVal,
          availableSlots: Math.max(0, Number(slots) || 0)
        }
      ]);
    });

    const targetMap = appendStartDates ? new Map(existingMap) : new Map();
    normalizedEntries.forEach(([key, value]) => targetMap.set(key, value));

    req.body.startDates = Array.from(targetMap.values());
  } else {
    // không gửi startDates → không sửa mảng cũ
    delete req.body.startDates;
  }
  // ------------------------


  const updated = await Tour.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({ status: 'success', data: { tour: updated } });
});

exports.deleteTour = factory.deleteOne(Tour);
exports.createTour = catchAsync(async (req, res, next) => {
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
    try {
      const parsedGuides = JSON.parse(req.body.guides);
      req.body.guides = Array.isArray(parsedGuides)
        ? parsedGuides
        : [parsedGuides];
    } catch (err) {
      req.body.guides = [req.body.guides];
    }
  }

  // Đảm bảo maxGroupSize là số
  if (req.body.maxGroupSize) {
    req.body.maxGroupSize = Number(req.body.maxGroupSize);
  }

  // Đảm bảo duration, price, priceDiscount là số
  ['duration', 'price', 'priceDiscount'].forEach(f => {
    if (req.body[f]) req.body[f] = Number(req.body[f]);
  });

  console.log('✅ Dữ liệu tạo tour sau khi xử lý:', {
    name: req.body.name,
    startDates: req.body.startDates,
    startLocation: req.body.startLocation,
    locations: req.body.locations,
    guides: req.body.guides
  });

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
