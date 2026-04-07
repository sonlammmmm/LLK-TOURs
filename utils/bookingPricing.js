const Service = require('../schemas/serviceModel');
const AppError = require('./appError');
const { validatePromotionForUser } = require('./promotionEngine');

// ==================== DỊCH VỤ & KHUYẾN MÃI ====================

// Chuẩn hoá payload dịch vụ chọn từ request
const sanitizeSelectedServices = raw => {
  if (!raw) return [];

  let payload;
  if (Array.isArray(raw)) {
    payload = raw;
  } else if (typeof raw === 'string') {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = [];
    }
  } else {
    payload = [];
  }

  return payload
    .map(item => {
      if (typeof item === 'string') {
        return { serviceId: item, quantity: 1 };
      }
      return {
        serviceId: item.serviceId || item.id || item._id,
        quantity:
          typeof item.quantity === 'number'
            ? item.quantity
            : Number.parseInt(item.quantity, 10) || 1
      };
    })
    .filter(item => !!item.serviceId);
};

// Giới hạn số lượng theo cấu hình dịch vụ
const clampQuantity = (service, requestedQty = 1, participants = 1) => {
  if (service.chargeType === 'per-person') {
    return Math.max(participants, 1);
  }

  if (!service.allowMultiple) {
    return 1;
  }

  const min = service.minQuantity || 1;
  const max = service.maxQuantity || min || 1;
  const qty = Math.max(requestedQty, min);
  return Math.min(qty, max);
};

// Tính toán tổng giá booking, dịch vụ và khuyến mãi
exports.buildBookingFinancials = async ({
  tour,
  participants,
  selectedServices,
  promotionCode,
  userId
}) => {
  if (!tour) {
    throw new AppError('Tour không tồn tại.', 404);
  }

  const safeParticipants = Math.max(Number.parseInt(participants, 10) || 1, 1);
  const normalizedSelection = sanitizeSelectedServices(selectedServices);
  const serviceIds = [
    ...new Set(
      normalizedSelection
        .map(item => item.serviceId)
        .filter(Boolean)
        .map(id => id.toString())
    )
  ];

  let activeServices = [];
  if (serviceIds.length > 0) {
    activeServices = await Service.find({
      _id: { $in: serviceIds },
      status: 'active'
    });
  }

  const serviceMap = new Map(
    activeServices.map(doc => [doc._id.toString(), doc])
  );

  let servicesTotal = 0;
  const servicesPayload = [];

  normalizedSelection.forEach(item => {
    const serviceDoc = serviceMap.get(item.serviceId.toString());
    if (!serviceDoc) return;

    const quantity = clampQuantity(serviceDoc, item.quantity, safeParticipants);
    const total = quantity * serviceDoc.price;
    servicesTotal += total;

    servicesPayload.push({
      serviceId: serviceDoc._id.toString(),
      name: serviceDoc.name,
      chargeType: serviceDoc.chargeType,
      price: serviceDoc.price,
      quantity,
      total
    });
  });

  const unitAmount = Math.round(Number(tour.price) || 0);
  const basePrice = unitAmount * safeParticipants;
  const subtotal = basePrice + servicesTotal;

  let promotionResult = null;
  if (promotionCode) {
    promotionResult = await validatePromotionForUser({
      code: promotionCode,
      userId,
      orderAmount: subtotal
    });
  }

  const discountAmount = promotionResult?.discountAmount || 0;
  const grandTotal = Math.max(subtotal - discountAmount, 0);

  return {
    basePrice,
    servicesTotal,
    subtotal,
    discountAmount,
    grandTotal,
    servicesPayload,
    promotion: promotionResult?.promotion || null,
    userPromotion: promotionResult?.userPromotion || null,
    promotionCode: promotionResult?.normalizedCode || null,
    promotionPerUserLimit: promotionResult?.perUserLimit || null,
    participants: safeParticipants
  };
};
