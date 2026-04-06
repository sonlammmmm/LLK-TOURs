const multer = require('multer');
const sharp = require('sharp');
const Tour = require('../schemas/tourModel');
const Booking = require('../schemas/bookingModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');

// ==================== CẤU HÌNH UPLOAD ẢNH ====================

// Lưu ảnh vào bộ nhớ tạm (buffer) để xử lý bằng Sharp trước khi ghi file
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
  fileFilter: multerFilter
});

// Helper: parse JSON an toàn, trả undefined nếu sai format
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

// Upload ảnh bìa (1) + ảnh chi tiết (tối đa 6)
exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 6 }
]);

// Helper: phát hiện định dạng ảnh từ tên file/mime type
const detectImageFormat = file => {
  const fallback = { extension: 'jpg', format: 'jpeg' };
  if (!file) return fallback;

  const original = file.originalname?.toLowerCase() || '';
  const extMatch = original.match(/\.([0-9a-z]+)$/i);
  let extension = extMatch ? extMatch[1] : '';
  const mime = file.mimetype || '';

  if (!extension) {
    if (mime.includes('jpeg') || mime.includes('jpg')) extension = 'jpg';
    else if (mime.includes('png')) extension = 'png';
    else if (mime.includes('webp')) extension = 'webp';
    else if (mime.includes('gif')) extension = 'gif';
  }

  if (!extension) return fallback;

  const format = extension === 'jpg' ? 'jpeg' : extension;
  if (!['jpeg', 'png', 'webp', 'gif'].includes(format)) {
    return fallback;
  }

  return { extension, format };
};

// Helper: áp dụng tuỳ chọn nén/chất lượng theo format
const applyFormatOptions = (instance, format) => {
  switch (format) {
    case 'jpeg':
      return instance.jpeg({ quality: 90 });
    case 'png':
      return instance.png({ compressionLevel: 9 });
    case 'webp':
      return instance.webp({ quality: 85 });
    case 'gif':
      return instance.gif({ reoptimise: true });
    default:
      return instance;
  }
};

// ==================== XỬ LÝ ẢNH ====================

// Resize ảnh bìa (2000×1333) + ảnh chi tiết, parse startLocation nếu là string
exports.resizeTourImages = catchAsync(async (req, res, next) => {
  if (!req.files) return next();

  // 1) Ảnh bìa
  if (req.files.imageCover) {
    const coverFile = req.files.imageCover[0];
    const { extension, format } = detectImageFormat(coverFile);
    const coverFilename = `tour-${req.params.id ||
      'new'}-${Date.now()}-cover.${extension}`;
    let pipeline = sharp(coverFile.buffer).resize(2000, 1333);
    pipeline = applyFormatOptions(pipeline, format);
    await pipeline.toFile(`public/img/tours/${coverFilename}`);
    req.body.imageCover = coverFilename;
  }

  // 2) Các ảnh khác
  if (req.files.images) {
    req.body.images = [];

    await Promise.all(
      req.files.images.map(async (file, i) => {
        const { extension, format } = detectImageFormat(file);
        const filename = `tour-${req.params.id || 'new'}-${Date.now()}-${i +
          1}.${extension}`;
        let pipeline = sharp(file.buffer).resize(2000, 1333);
        pipeline = applyFormatOptions(pipeline, format);
        await pipeline.toFile(`public/img/tours/${filename}`);

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

// ==================== MIDDLEWARE ====================

// Alias: top 5 tour tốt nhất (rating cao, giá thấp)
exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary';
  next();
};

// Parse các field JSON từ multipart form (startDates, startLocation, locations)
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
          //Chỉ default khi CREATE
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

// ==================== CRUD TOUR ====================

// Lấy tất cả tour (hỗ trợ filter, sort, paginate)
exports.getAllTours = factory.getAll(Tour);

// Lấy chi tiết 1 tour kèm populate reviews
exports.getTour = factory.getOne(Tour, { path: 'reviews' });

// Cập nhật tour: merge/thay thế startDates, parse JSON, ép kiểu số
exports.updateTour = catchAsync(async (req, res, next) => {
  const current = await Tour.findById(req.params.id);
  if (!current) return next(new AppError('Không tìm thấy tour', 404));

  const appendStartDates =
    req.body.appendStartDates === true || req.body.appendStartDates === 'true';
  delete req.body.appendStartDates;

  // Ép kiểu số nếu có trong payload
  ['maxGroupSize', 'duration', 'price', 'priceDiscount'].forEach(f => {
    if (req.body[f] != null) req.body[f] = Number(req.body[f]);
  });

  // Parse an toàn nếu client gửi JSON string
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

  // Merge hoặc thay thế startDates tuỳ mode
  let incoming = req.body.startDates;
  if (typeof incoming === 'string') {
    incoming = tryParseJSON(incoming, 'startDates');
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

  const updated = await Tour.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({ status: 'success', data: { tour: updated } });
});

// Xóa tour (nếu đã phát sinh giao dịch thì chỉ ẩn khỏi web)
exports.deleteTour = catchAsync(async (req, res, next) => {
  const tourQuery = Tour.findById(req.params.id);
  tourQuery._includeHiddenTours = true;
  const tour = await tourQuery;

  if (!tour) {
    return next(new AppError('Không tìm thấy tour với ID này', 404));
  }

  const hasTransactions = await Booking.exists({ tour: tour._id });

  if (hasTransactions) {
    if (!tour.isHidden) {
      tour.isHidden = true;
      await tour.save({ validateBeforeSave: false });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        action: 'hidden',
        message: 'Tour đã phát sinh giao dịch nên chỉ được ẩn khỏi website.'
      }
    });
  }

  const deleteQuery = Tour.findByIdAndDelete(req.params.id);
  deleteQuery._includeHiddenTours = true;
  await deleteQuery;

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Tạo tour mới: parse JSON string (startDates, startLocation, locations, guides), ép kiểu số
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

  const newTour = await Tour.create(req.body);

  res.status(201).json({
    status: 'success',
    data: { tour: newTour }
  });
});

// ==================== TÌM KIẾM ĐỊA LÝ ==================== Đang phát triển
// Tìm tour trong bán kính nhất định từ tọa độ (geoWithin)
// exports.getToursWithin = catchAsync(async (req, res, next) => {
//   const { distance, latlng, unit } = req.params;
//   const [lat, lng] = latlng.split(',');

//   const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

//   if (!lat || !lng) {
//     next(
//       new AppError(
//         'Vui lòng cung cấp vĩ độ và kinh độ theo định dạng lat,lng.',
//         400
//       )
//     );
//   }

//   const tours = await Tour.find({
//     startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } }
//   });

//   res.status(200).json({
//     status: 'success',
//     results: tours.length,
//     data: {
//       data: tours
//     }
//   });
// });

// Tính khoảng cách từ tọa độ đến tất cả tour (geoNear aggregate)
// exports.getDistances = catchAsync(async (req, res, next) => {
//   const { latlng, unit } = req.params;
//   const [lat, lng] = latlng.split(',');
//
//   const multiplier = unit === 'mi' ? 0.000621371 : 0.001;
//
//   if (!lat || !lng) {
//     next(
//       new AppError(
//         'Vui lòng cung cấp vĩ độ và kinh độ theo định dạng lat,lng.',
//         400
//       )
//     );
//   }
//
//   const distances = await Tour.aggregate([
//     {
//       $geoNear: {
//         near: {
//           type: 'Point',
//           coordinates: [lng * 1, lat * 1]
//         },
//         distanceField: 'distance',
//         distanceMultiplier: multiplier
//       }
//     },
//     {
//       $project: {
//         distance: 1,
//         name: 1
//       }
//     }
//   ]);
//
//   res.status(200).json({
//     status: 'success',
//     data: {
//       data: distances
//     }
//   });
// });
