const SiteSetting = require('../models/siteSettingModel');
const catchAsync = require('../utils/catchAsync');

// Lấy thông tin cài đặt website (public)
exports.getSettings = catchAsync(async (req, res, next) => {
  const settings = await SiteSetting.getSettings();

  res.status(200).json({
    status: 'success',
    data: {
      data: settings
    }
  });
});

// Admin: Cập nhật thông tin cài đặt website
exports.updateSettings = catchAsync(async (req, res, next) => {
  // Lấy settings hiện tại (singleton)
  const settings = await SiteSetting.getSettings();

  // Danh sách các trường được phép cập nhật
  const allowedFields = [
    'address',
    'phone',
    'email',
    'hotline',
    'businessLicense',
    'licenseNote',
    'socialFacebook',
    'socialInstagram',
    'socialYoutube',
    'socialTiktok',
    'socialGithub',
    'brandDescription',
    'brandHighlights',
    'ctaTitle',
    'ctaDescription'
  ];

  // Chỉ cập nhật các trường được phép
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) {
      settings[field] = req.body[field];
    }
  });

  await settings.save();

  res.status(200).json({
    status: 'success',
    data: {
      data: settings
    }
  });
});
