/* eslint-disable prettier/prettier */
const mongoose = require('mongoose');

const siteSettingSchema = new mongoose.Schema(
  {
    // Thông tin liên hệ
    address: {
      type: String,
      trim: true,
      default:
        'Khu Công nghệ cao Xa lộ Hà Nội, Hiệp Phú, TP. Thủ Đức, TP. HCM'
    },
    phone: {
      type: String,
      trim: true,
      default: '038****234'
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: 'transysonlam@gmail.com'
    },
    hotline: {
      type: String,
      trim: true,
      default: '038****234'
    },

    // Giấy phép kinh doanh
    businessLicense: {
      type: String,
      trim: true,
      default: '01-001/2020/TCDL-GP LHQT'
    },
    licenseNote: {
      type: String,
      trim: true,
      default:
        'Đã đăng ký Bộ Công Thương Việt Nam | Thành viên Hiệp hội Du lịch Việt Nam'
    },

    // Mạng xã hội
    socialFacebook: {
      type: String,
      trim: true,
      default: 'https://www.facebook.com/sonlammmmmm/'
    },
    socialInstagram: {
      type: String,
      trim: true,
      default: 'https://www.instagram.com/sonlammmmmm/'
    },
    socialYoutube: {
      type: String,
      trim: true,
      default: ''
    },
    socialTiktok: {
      type: String,
      trim: true,
      default: ''
    },
    socialGithub: {
      type: String,
      trim: true,
      default: ''
    },

    // Thông tin thương hiệu
    brandDescription: {
      type: String,
      trim: true,
      default:
        'LLK Tours chuyên tổ chức hành trình mượt mà, trọn cảm xúc với đội ngũ chuyên gia bản địa.'
    },
    brandHighlights: {
      type: String,
      trim: true,
      default: 'Hà Nội • TP. HCM • Đà Nẵng'
    },

    // CTA
    ctaTitle: {
      type: String,
      trim: true,
      default: 'Sẵn sàng cho hành trình tiếp theo?'
    },
    ctaDescription: {
      type: String,
      trim: true,
      default:
        'Nhận gợi ý cá nhân hóa và lịch khởi hành phù hợp từ đội chuyên viên hành trình LLK bằng tiếng Việt bất cứ khi nào bạn cần.'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Đảm bảo chỉ có duy nhất 1 document settings (singleton pattern)
siteSettingSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const SiteSetting = mongoose.model('SiteSetting', siteSettingSchema);

module.exports = SiteSetting;
