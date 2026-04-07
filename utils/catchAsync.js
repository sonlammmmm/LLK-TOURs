// Wrapper cho async controller để tự động catch lỗi
module.exports = fn => (req, res, next) => {
  fn(req, res, next).catch(next);
};
