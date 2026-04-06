const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Vui lòng cho chúng tôi biết tên của bạn!']
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  googleId: {
    type: String,
    select: false
  },
  email: {
    type: String,
    required: [true, 'Vui lòng cung cấp email của bạn'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Vui lòng cung cấp một email hợp lệ']
  },
  photo: {
    type: String,
    default: 'default.jpg'
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user'
  },
  password: {
    type: String,
    required: [
      function() {
        return this.authProvider === 'local';
      },
      'Vui lòng cung cấp mật khẩu'
    ],
    minlength: 8,
    select: false
  },
  passwordConfirm: {
    type: String,
    required: [
      function() {
        return this.authProvider === 'local';
      },
      'Vui lòng xác nhận mật khẩu'
    ],
    validate: {
      // Chỉ hoạt động khi TẠO hoặc LƯu!!!
      validator: function(el) {
        if (this.authProvider !== 'local') return true;
        return el === this.password;
      },
      message: 'Mật khẩu không khớp!'
    }
  },
  passwordChangedAt: Date,
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  active: {
    type: Boolean,
    default: true,
    select: false
  }
});

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.__v;
    return ret;
  }
});

userSchema.set('toObject', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.__v;
    return ret;
  }
});

userSchema.pre('save', async function(next) {
  // Chỉ chạy hàm này nếu mật khẩu thực sự được sửa đổi
  if (!this.isModified('password') || !this.password) return next();

  // Băm mật khẩu với chi phí 12
  this.password = await bcrypt.hash(this.password, 12);

  // Xóa trường xác nhận mật khẩu
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Sửa lại query middleware để không lọc người dùng không hoạt động trong các route quản lý
userSchema.pre(/^find/, function(next) {
  // Kiểm tra nếu đang ở route quản lý hoặc đang cập nhật người dùng
  if (this._adminRoute || this.op === 'findOneAndUpdate') {
    return next();
  }

  // Nếu không phải route quản lý thì lọc người dùng không hoạt động
  this.find({ active: { $ne: false } });
  next();
});

userSchema.methods.correctPassword = async (candidatePassword, userPassword) =>
  !candidatePassword || !userPassword
    ? false
    : await bcrypt.compare(candidatePassword, userPassword);

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = Number.parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );

    return JWTTimestamp < changedTimestamp;
  }

  // False nghĩa là KHÔNG bị thay đổi
  return false;
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  console.log({ resetToken }, this.passwordResetToken);

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
