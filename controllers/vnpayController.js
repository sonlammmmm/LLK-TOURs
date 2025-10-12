/* eslint-disable camelcase */
const crypto = require('crypto');
const qs = require('qs');
const moment = require('moment');
const Booking = require('../models/bookingModel');
const Tour = require('../models/tourModel');

function removeVietnameseTones(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/Đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\w\s]/gi, '')
    .trim();
}

// === TẠO URL THANH TOÁN VNPAY ===
exports.createPaymentUrl = async (req, res) => {
  try {
    let ipAddr =
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip ||
      '127.0.0.1';
    if (ipAddr === '::1') ipAddr = '127.0.0.1';

    const { tourId, participants, startDate } = req.query;

    if (!startDate) {
      return res.status(400).json({
        status: 'fail',
        message: 'Vui lòng chọn ngày khởi hành'
      });
    }

    const tour = await Tour.findById(tourId);
    if (!tour) {
      return res.status(404).json({
        status: 'fail',
        message: 'Không tìm thấy tour'
      });
    }

    const amount = tour.price * (participants || 1);
    const createDate = moment().format('YYYYMMDDHHmmss');
    const expireDate = moment()
      .add(15, 'minutes')
      .format('YYYYMMDDHHmmss');
    const orderId = moment().format('HHmmss');

    const returnUrl = `${
      process.env.VNP_RETURNURL
    }?tourId=${tourId}&participants=${participants}&startDate=${encodeURIComponent(
      startDate
    )}`;

    const vnp_Params = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: process.env.VNP_TMNCODE,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: orderId,
      vnp_OrderInfo: `Thanh toan tour ${removeVietnameseTones(tour.name)}`,
      vnp_OrderType: 'other',
      vnp_Amount: amount * 100,
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate
    };

    // === Sắp xếp key theo thứ tự tăng dần ===
    const sorted = Object.keys(vnp_Params)
      .sort()
      .reduce((obj, key) => {
        obj[key] = vnp_Params[key];
        return obj;
      }, {});

    // === Tạo chuỗi ký KHÔNG encode ===
    const signData = qs.stringify(sorted, { encode: false });
    const hmac = crypto.createHmac('sha512', process.env.VNP_HASHSECRET);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    sorted.vnp_SecureHash = signed;

    // === Tạo URL thanh toán với encode ===
    const paymentUrl = `${process.env.VNP_URL}?${qs.stringify(sorted, {
      encode: false
    })}`;

    console.log('✅ URL THANH TOÁN:', paymentUrl);
    res.status(200).json({ status: 'success', paymentUrl });
  } catch (err) {
    console.error('❌ Lỗi VNPAY:', err);
    res.status(500).json({
      status: 'error',
      message: 'Không thể tạo URL thanh toán'
    });
  }
};

exports.vnpayReturn = async (req, res) => {
  try {
    const vnp_Params = { ...req.query };
    const secureHash = vnp_Params.vnp_SecureHash;

    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    const sorted = Object.keys(vnp_Params)
      .sort()
      .reduce((obj, key) => {
        obj[key] = vnp_Params[key];
        return obj;
      }, {});

    const secretKey = process.env.VNP_HASHSECRET;
    const signData = qs.stringify(sorted, { encode: false });
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash !== signed) {
      console.warn('⚠️ Chữ ký không hợp lệ (vnpayReturn)!');
      console.log('Expected:', signed);
      console.log('Received:', secureHash);
      console.log('SignData:', signData);

      return res.render('bookingSuccess', {
        title: 'Thanh toán thất bại',
        message: 'Chữ ký không hợp lệ.'
      });
    }

    // --- Xử lý khi giao dịch thành công ---
    if (vnp_Params.vnp_ResponseCode === '00') {
      const { tourId, participants, startDate } = req.query;
      const userId = req.user?.id;

      if (!tourId || !participants || !startDate || !userId) {
        return res.render('bookingSuccess', {
          title: 'Thanh toán thất bại',
          message: 'Thiếu thông tin booking.'
        });
      }

      const tour = await Tour.findById(tourId);
      if (!tour) {
        return res.render('bookingSuccess', {
          title: 'Thanh toán thất bại',
          message: 'Không tìm thấy tour.'
        });
      }

      // Kiểm tra xem đã tạo booking chưa (tránh duplicate)
      const existingBooking = await Booking.findOne({
        tour: tourId,
        user: userId,
        startDate: new Date(startDate)
      });

      if (existingBooking) {
        console.log('✅ Booking đã tồn tại:', existingBooking._id);
        return res.redirect(`/booking-success?booking=${existingBooking._id}`);
      }

      const booking = await Booking.create({
        tour: tourId,
        user: userId,
        price: tour.price * participants,
        participants: parseInt(participants, 10),
        startDate: new Date(startDate),
        paid: true,
        paymentMethod: 'vnpay'
      });

      console.log('✅ GIAO DỊCH THÀNH CÔNG:', booking._id);
      return res.redirect(`/booking-success?booking=${booking._id}`);
    }

    return res.render('bookingSuccess', {
      title: 'Thanh toán thất bại',
      message: `Giao dịch không thành công. Mã lỗi: ${vnp_Params.vnp_ResponseCode}`
    });
  } catch (err) {
    console.error('❌ Lỗi xử lý callback VNPAY:', err);
    return res.render('bookingSuccess', {
      title: 'Lỗi',
      message: 'Đã xảy ra lỗi trong quá trình xác minh giao dịch.'
    });
  }
};

// XỬ LÝ IPN (Server → Server)
exports.vnpayIpn = async (req, res) => {
  try {
    const vnp_Params = { ...req.query };
    const secureHash = vnp_Params.vnp_SecureHash;

    delete vnp_Params.vnp_SecureHash;
    delete vnp_Params.vnp_SecureHashType;

    // ✅ FIX: KHÔNG decode thêm
    const sorted = Object.keys(vnp_Params)
      .sort()
      .reduce((obj, key) => {
        obj[key] = vnp_Params[key];
        return obj;
      }, {});

    const secretKey = process.env.VNP_HASHSECRET;
    const signData = qs.stringify(sorted, { encode: false });
    const hmac = crypto.createHmac('sha512', secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash !== signed) {
      return res.status(200).json({
        RspCode: '97',
        Message: 'Invalid signature'
      });
    }

    if (vnp_Params.vnp_ResponseCode === '00') {
      console.log('✅ IPN: Thanh toán thành công -', vnp_Params.vnp_TxnRef);
    }

    return res.status(200).json({
      RspCode: '00',
      Message: 'Success'
    });
  } catch (err) {
    console.error('❌ Lỗi xử lý IPN:', err);
    return res.status(200).json({
      RspCode: '99',
      Message: 'Error'
    });
  }
};
