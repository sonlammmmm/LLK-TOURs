const Service = require('../models/serviceModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

// ==================== CRUD DỊCH VỤ ====================

// Lấy tất cả dịch vụ (admin)
exports.getServices = factory.getAll(Service);
// Lấy chi tiết 1 dịch vụ
exports.getService = factory.getOne(Service);
// Tạo dịch vụ mới
exports.createService = factory.createOne(Service);
// Cập nhật dịch vụ
exports.updateService = factory.updateOne(Service);

// Xóa dịch vụ: nếu đã phát sinh booking → chỉ ẩn (inactive), chưa có → xóa hẳn
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

// ==================== TOGGLE & PUBLIC ====================

// Bật/tắt trạng thái dịch vụ (active ↔ inactive)
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

// Lấy danh sách dịch vụ công khai đang hoạt động (hiển thị cho khách hàng)
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
