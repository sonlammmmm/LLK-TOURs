const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

// ==================== FACTORY HANDLER (CRUD dùng chung) ====================

// Xóa 1 document theo ID
exports.deleteOne = Model =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.findByIdAndDelete(req.params.id);

    if (!doc) {
      return next(new AppError('Không tìm thấy tài liệu với ID này', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null
    });
  });

// Cập nhật 1 document theo ID
exports.updateOne = Model =>
  catchAsync(async (req, res, next) => {
    // Tạo truy vấn và đánh dấu đây là route quản lý nếu đang cập nhật User
    const query = Model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    // Nếu đang cập nhật User, đánh dấu là route quản trị
    if (Model.modelName === 'User') {
      query._adminRoute = true;
    }

    const doc = await query;

    if (!doc) {
      return next(new AppError('Không tìm thấy tài liệu với ID này', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc
      }
    });
  });

// Tạo mới 1 document
exports.createOne = Model =>
  catchAsync(async (req, res, next) => {
    const doc = await Model.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        data: doc
      }
    });
  });

// Lấy 1 document theo ID (hỗ trợ populate)
exports.getOne = (Model, popOptions) =>
  catchAsync(async (req, res, next) => {
    let query = Model.findById(req.params.id);
    if (popOptions) query = query.populate(popOptions);
    const doc = await query;

    if (!doc) {
      return next(new AppError('Không tìm thấy tài liệu với ID này', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        data: doc
      }
    });
  });

// Lấy tất cả documents (hỗ trợ lọc, sắp xếp, phân trang)
exports.getAll = (Model, popOptions) =>
  catchAsync(async (req, res, next) => {
    let filter = {};
    if (req.params.tourId) filter = { tour: req.params.tourId };

    let query = Model.find(filter);
    if (popOptions) query = query.populate(popOptions);

    const features = new APIFeatures(query, req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate();

    const doc = await features.query;

    res.status(200).json({
      status: 'success',
      results: doc.length,
      // eslint-disable-next-line prettier/prettier
      data: { data: doc },
    });
  });
