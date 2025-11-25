/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

const redirectAfterLogin = user => {
  const redirectUrl = user && user.role === 'admin' ? '/admin/dashboard' : '/';
  window.setTimeout(() => {
    location.assign(redirectUrl);
  }, 1200);
};

const handleAuthSuccess = user => {
  showAlert('success', 'Đăng nhập thành công');
  redirectAfterLogin(user);
};

export const login = async (email, password) => {
  try {
    const res = await axios({
      method: 'POST',
      url: '/api/v1/users/login',
      data: { email, password }
    });

    if (res.data.status === 'success') {
      const user = res.data && res.data.data && res.data.data.user;
      handleAuthSuccess(user);
    }
  } catch (err) {
    const message =
      (err.response && err.response.data && err.response.data.message) ||
      'Đăng nhập thất bại. Vui lòng thử lại.';
    showAlert('error', message);
  }
};

export const logout = async () => {
  try {
    const res = await axios({
      method: 'GET',
      url: '/api/v1/users/logout'
    });
    if (res.data.status === 'success') location.assign('/');
  } catch (err) {
    console.log(err.response);
    showAlert('error', 'Lỗi không thể đăng xuất! Hãy thử lại');
  }
};

const handleGoogleCredential = async credential => {
  try {
    const res = await axios({
      method: 'POST',
      url: '/api/v1/users/google-login',
      data: { credential }
    });

    if (res.data && res.data.status === 'success') {
      const user = res.data && res.data.data && res.data.data.user;
      handleAuthSuccess(user);
    }
  } catch (err) {
    const message =
      (err.response && err.response.data && err.response.data.message) ||
      'Đăng nhập Google thất bại. Vui lòng thử lại.';
    showAlert('error', message);
  }
};

const updatePlaceholderCopy = (container, { title, subtitle }) => {
  const placeholder = container.querySelector('.auth-social__placeholder-text');
  if (!placeholder) return;

  const titleEl = placeholder.querySelector('span');
  const subtitleEl = placeholder.querySelector('small');

  if (titleEl && title) titleEl.textContent = title;
  if (subtitleEl && subtitle) subtitleEl.textContent = subtitle;
};

export const initGoogleLogin = () => {
  const container = document.getElementById('google-signin-btn');
  const clientId = window.GOOGLE_CLIENT_ID;
  if (!container || !clientId) return;

  let initialized = false;

  const setState = (state, copy = {}) => {
    container.dataset.state = state;
    container.classList.remove('is-loading', 'is-ready', 'is-error');
    if (state === 'loading') container.classList.add('is-loading');
    if (state === 'ready') container.classList.add('is-ready');
    if (state === 'error') container.classList.add('is-error');
    if (copy.title || copy.subtitle) updatePlaceholderCopy(container, copy);
  };

  const renderPlaceholder = (copy = {}) => {
    container.innerHTML = `
      <div class="auth-social__placeholder">
        <i class="fa-brands fa-google"></i>
        <div class="auth-social__placeholder-text">
          <span>${copy.title || 'Đang khởi tạo Google SSO...'}</span>
          <small>${copy.subtitle || 'Giữ trình duyệt mở để tiếp tục'}</small>
        </div>
      </div>
    `;
  };

  renderPlaceholder();
  setState('loading');

  const renderGoogleButton = () => {
    if (initialized) return;
    initialized = true;

    window.google.accounts.id.initialize({
      client_id: clientId,
      ux_mode: 'popup',
      auto_select: false,
      use_fedcm_for_prompt: false,
      cancel_on_tap_outside: true,
      context: 'signin',
      callback: response => {
        if (response && response.credential) {
          setState('loading', {
            title: 'Đang xác thực...',
            subtitle: 'Đang kết nối tới Google'
          });
          handleGoogleCredential(response.credential);
        } else {
          showAlert('error', 'Không lấy được thông tin đăng nhập từ Google.');
          setState('error', {
            title: 'Không tải được Google',
            subtitle: 'Bấm để thử lại'
          });
        }
      }
    });

    window.google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      width: 360,
      text: 'signin_with'
    });

    window.setTimeout(() => {
      setState('ready', {
        title: 'Sẵn sàng đăng nhập',
        subtitle: 'Nhấn để tiếp tục với Google'
      });
    }, 150);
  };

  const waitForGoogle = (attempt = 0) => {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      renderGoogleButton();
      return;
    }

    if (attempt >= 40) {
      console.warn('Google Identity script không sẵn sàng.');
      renderPlaceholder({
        title: 'Không tải được Google',
        subtitle: 'Nhấn để thử lại'
      });
      setState('error');
      return;
    }

    window.setTimeout(() => waitForGoogle(attempt + 1), 150);
  };

  container.addEventListener('click', () => {
    if (container.dataset.state === 'error') {
      renderPlaceholder({
        title: 'Đang khởi tạo lại Google SSO...',
        subtitle: 'Vui lòng đợi trong giây lát'
      });
      setState('loading');
      initialized = false;
      waitForGoogle();
    }
  });

  waitForGoogle();
};
