/* eslint-disable */

export const hideAlert = (el) => {
  if (el) {
    el.classList.add('hide');
    setTimeout(() => {
      if (el.parentElement) el.parentElement.removeChild(el);
    }, 400);
  }
};

// HIỂN THỊ ALERT
export const showAlert = (type, msg) => {
  // Lấy container có sẵn trong base.pug
  const container = document.querySelector('.alert-container');
  if (!container) {
    console.error('⚠️ Không tìm thấy .alert-container trong DOM!');
    return;
  }

  // Icon tùy theo loại
  let icon = '';
  switch (type) {
    case 'success':
      icon = '<i class="fas fa-check-circle fa-lg"></i>';
      break;
    case 'error':
      icon = '<i class="fas fa-exclamation-circle fa-lg"></i>';
      break;
    case 'info':
      icon = '<i class="fas fa-bell fa-lg"></i>';
      break;
    default:
      icon = '<i class="fas fa-info-circle fa-lg"></i>';
  }

  // Cấu trúc alert
  const markup = `
    <div class="alert alert--${type}">
      <span class="alert__icon">${icon}</span>
      <span class="alert__message">${msg}</span>
    </div>
  `;

  // Thêm alert mới vào cuối container (nằm dưới alert trước)
  container.insertAdjacentHTML('beforeend', markup);

  const newAlert = container.lastElementChild;

  // Tự động ẩn sau 5 giây
  setTimeout(() => hideAlert(newAlert), 5000);
};
