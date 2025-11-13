const Service = require('../models/serviceModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

exports.getServices = factory.getAll(Service);
exports.getService = factory.getOne(Service);
exports.createService = factory.createOne(Service);
exports.updateService = factory.updateOne(Service);

exports.deleteService = catchAsync(async (req, res, next) => {
  const service = await Service.findById(req.params.id);
  if (!service) {
    return next(new AppError('Không tìm thấy dịch vụ.', 404));
  }

  const hasUsage = await Booking.exists({
    'services.service': service._id
  });

  if (hasUsage) {
    service.status = 'inactive';
    service.archivedAt = new Date();
    await service.save();
    return res.status(200).json({
      status: 'success',
      message: 'Dịch vụ đã phát sinh giao dịch nên chỉ có thể ẩn thay vì xóa.',
      data: {
        data: service
      }
    });
  }

  await service.deleteOne();
  return res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.toggleStatus = catchAsync(async (req, res, next) => {
  const service = await Service.findById(req.params.id);
  if (!service) {
    return next(new AppError('Không tìm thấy dịch vụ.', 404));
  }

  service.status = service.status === 'active' ? 'inactive' : 'active';
  await service.save();

  res.status(200).json({
    status: 'success',
    data: {
      data: service
    }
  });
});

exports.getActivePublicServices = catchAsync(async (req, res, next) => {
  const services = await Service.find({
    status: 'active',
    visibility: 'public'
  }).sort({ displayOrder: 1, name: 1 });

  res.status(200).json({
    status: 'success',
    results: services.length,
    data: services
  });
});
