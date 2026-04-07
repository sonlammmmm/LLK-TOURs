const nodemailer = require('nodemailer');
const pug = require('pug');
const { htmlToText } = require('html-to-text');

// ==================== EMAIL SERVICE ====================
module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Trần Sỷ Sơn Lâm <${process.env.EMAIL_FROM}>`;
  }

  // Tạo transport theo môi trường
  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      // Email GG
      return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });
    }

    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  // Gửi email thực tế
  async send(template, subject) {
    // 1) Hiển thị HTML dựa trên mẫu pug
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      url: this.url,
      subject
    });

    // 2) Xác định các tùy chọn email
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: htmlToText(html)
    };

    // 3) Tạo transport vận chuyển và gửi email
    await this.newTransport().sendMail(mailOptions);
  }

  // Email chào mừng
  async sendWelcome() {
    await this.send('welcome', 'Welcome to LLK Tours!');
  }

  // Email reset mật khẩu
  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Mã đặt lại mật khẩu (Hiệu lực trong 10 phút)'
    );
  }
};
