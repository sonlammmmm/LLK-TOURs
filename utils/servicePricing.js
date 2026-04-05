const Service = require('../schemas/serviceModel');

const normalizeSelection = raw => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.services)) return parsed.services;
    } catch (err) {
      console.warn(
        '[servicePricing] Không thể phân tích dữ liệu dịch vụ:',
        err
      );
    }
  }

  return [];
};

const formatSelection = items =>
  items
    .map(item => ({
      serviceId: item.serviceId || item.id || item._id,
      quantity: item.quantity
    }))
    .filter(item => item.serviceId);

exports.parseSelectedServices = raw => formatSelection(normalizeSelection(raw));

exports.calculateServicePricing = async (rawSelection, participants = 1) => {
  const selection = exports.parseSelectedServices(rawSelection);
  if (!selection.length) {
    return {
      services: [],
      serviceTotal: 0,
      serialized: JSON.stringify([])
    };
  }

  const ids = [...new Set(selection.map(item => item.serviceId))];
  const services = await Service.find({
    _id: { $in: ids },
    isActive: true
  }).lean();

  const serviceMap = services.reduce((acc, service) => {
    acc[String(service._id)] = service;
    return acc;
  }, {});

  const breakdown = [];
  let serviceTotal = 0;

  selection.forEach(item => {
    const serviceDoc = serviceMap[item.serviceId];
    if (!serviceDoc) return;

    const unitPrice = Number(serviceDoc.price) || 0;
    const qty =
      serviceDoc.billingType === 'per_person'
        ? Math.max(Number(participants) || 1, 1)
        : Math.max(Number(item.quantity) || 1, 1);
    const totalPrice = unitPrice * qty;

    breakdown.push({
      service: serviceDoc._id,
      name: serviceDoc.name,
      description: serviceDoc.description,
      billingType: serviceDoc.billingType,
      unitPrice,
      quantity: qty,
      totalPrice
    });
    serviceTotal += totalPrice;
  });

  return {
    services: breakdown,
    serviceTotal,
    serialized: JSON.stringify(
      breakdown.map(item => ({
        serviceId: item.service,
        quantity: item.quantity
      }))
    )
  };
};
