/* eslint-disable camelcase */
const crypto = require('crypto');
const qs = require('qs');
const moment = require('moment');
const Booking = require('../models/bookingModel');
const Tour = require('../models/tourModel');

// ✅ TẠO URL THANH TOÁN VNPAY
exports.createPaymentUrl = async (req, res) => {
  try {
    const ipAddr =
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress;

    const { tourId, startDate, participants } = req.query;
    const tour = await Tour.findById(tourId);
    if (!tour)
      return res
        .status(404)
        .json({ status: 'fail', message: 'Không tìm thấy tour' });

    const amount = tour.price * (participants || 1);
    const createDate = moment().format('YYYYMMDDHHmmss');
    const orderId = moment().format('HHmmss');

    const tmnCode = process.env.VNP_TMNCODE;
    const secretKey = process.env.VNP_HASHSECRET;
    const vnpUrl = process.env.VNP_URL;
    const returnUrl = process.env.VNP_RETURNURL;

    const vnp_Params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderId,
      vnp_OrderInfo: `Thanh toán tour ${tour.name}`,
      vnp_OrderType: 'other',
      vnp_Amount: amount * 100,
      vnp_ReturnUrl: `${returnUrl}?tourId=${tourId}&participants=${participants}&startDate=${encodeURIComponent(
        startDate
      )}`,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate
    };

    const sorted = Object.keys(vnp_Params)
      .sort()
      .reduce((obj, key) => {
        obj[key] = vnp_Params[key];
        return obj;
      }, {});

    const signData = qs.stringify(sorted, { encode: false });
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    sorted.vnp_SecureHash = signed;

    const paymentUrl = `${vnpUrl}?${qs.stringify(sorted, { encode: false })}`;

    return res.status(200).json({ status: 'success', paymentUrl });
  } catch (err) {
    console.error('❌ Lỗi tạo URL VNPAY:', err);
    return res.status(500).json({
      status: 'error',
      message: 'Không thể tạo liên kết thanh toán VNPAY'
    });
  }
};

// ✅ XỬ LÝ KHI VNPAY GỌI LẠI (RETURN URL)
exports.vnpayReturn = async (req, res) => {
  try {
    const vnp_Params = { ...req.query };
    const secureHash = vnp_Params.vnp_SecureHash;

    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    const secretKey = process.env.VNP_HASHSECRET;
    const signData = qs.stringify(vnp_Params, { encode: false });
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash !== signed) {
      return res.render('bookingSuccess', {
        title: 'Thanh toán thất bại',
        message: 'Chữ ký không hợp lệ.'
      });
    }

    if (vnp_Params.vnp_ResponseCode === '00') {
      const { tourId, participants, startDate } = req.query;
      const userId = req.user.id;

      const tour = await Tour.findById(tourId);
      if (!tour) throw new Error('Không tìm thấy tour');

      const booking = await Booking.create({
        tour: tourId,
        user: userId,
        price: tour.price * participants,
        participants,
        startDate: new Date(startDate),
        paid: true,
        paymentMethod: 'vnpay'
      });

      return res.redirect(`/booking-success?booking=${booking._id}`);
    }

    return res.render('bookingSuccess', {
      title: 'Thanh toán thất bại',
      message: 'Giao dịch không thành công.'
    });
  } catch (err) {
    console.error('❌ Lỗi xử lý callback VNPAY:', err);
    return res.render('bookingSuccess', {
      title: 'Lỗi',
      message: 'Đã xảy ra lỗi trong quá trình xác minh giao dịch.'
    });
  }
};
