/* eslint-disable */

const pollBookingStatus = (sid, provider, providerName) => {
  if (!sid) return;
  const providerLabel = providerName || 'Stripe';
  const providerKey =
    typeof provider === 'string' && provider.toLowerCase() === 'momo'
      ? 'momo'
      : 'stripe';

  const maxAttempts = 30;
  const interval = 2000;
  let attempts = 0;

  const checkStatus = async () => {
    try {
      attempts += 1;
      const res = await fetch(
        `/api/v1/bookings/by-session/${sid}?provider=${providerKey}`
      );
      const data = await res.json();

      if (data.status === 'success' && data.data) {
        window.location.reload();
        return;
      }

      if (attempts < maxAttempts) {
        setTimeout(checkStatus, interval);
      } else {
        const pendingCard = document.querySelector(
          '.booking-success__card--pending'
        );
        if (pendingCard) {
          pendingCard.innerHTML = `
            <div class="booking-success__card-header">
              <h2>Không thể xác nhận thanh toán</h2>
              <p>Chúng tôi chưa tìm thấy booking tương ứng với phiên ${providerLabel} này.</p>
            </div>
            <p>Vui lòng kiểm tra mục "<strong>Tour của tôi</strong>" hoặc liên hệ với đội ngũ hỗ trợ để được trợ giúp thêm.</p>
            <div class="booking-success__links">
              <a class="btn btn--green" href="/my-tours">Tour của tôi</a>
              <a class="btn btn--ghost" href="/">Trang chủ</a>
            </div>
          `;
        }
      }
    } catch (err) {
      console.error('[POLL] Error:', err);
      if (attempts < maxAttempts) {
        setTimeout(checkStatus, interval);
      }
    }
  };

  setTimeout(checkStatus, 1000);
};

const COUNTDOWN_ENABLED = true;

const initCountdownRedirect = () => {
  if (!COUNTDOWN_ENABLED) return;

  const container = document.querySelector('[data-redirect-seconds]');
  if (!container) return;

  const target = container.dataset.redirectTarget || '/';
  const seconds = parseInt(container.dataset.redirectSeconds || '0', 10);
  const counterEl = container.querySelector('[data-redirect-counter]');

  if (!seconds || seconds < 1 || !counterEl) return;

  let remaining = seconds;
  let countdownIntervalId = null;

  const updateCounter = value => {
    counterEl.textContent = String(value);
  };

  const tick = () => {
    remaining -= 1;
    if (remaining <= 0) {
      updateCounter(0);
      window.clearInterval(countdownIntervalId);
      window.location.assign(target);
    } else {
      updateCounter(remaining);
    }
  };

  updateCounter(remaining);
  countdownIntervalId = window.setInterval(tick, 1000);

  const cancelRedirect = () => {
    if (!countdownIntervalId) return;
    window.clearInterval(countdownIntervalId);
    countdownIntervalId = null;
    container.classList.add('is-paused');

    const label = container.querySelector('.booking-success__countdown-label');
    if (label) {
      label.textContent = 'Đếm ngược đã tạm dừng';
    }

    const hint = container.querySelector('.booking-success__countdown-hint');
    if (hint) {
      hint.textContent = 'Bạn có thể ở lại trang này bao lâu tùy thích.';
    }
  };

  const cancelBtn = document.querySelector('[data-redirect-cancel]');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', event => {
      event.preventDefault();
      cancelRedirect();
    });
  }
};

export const initBookingSuccess = () => {
  const root = document.querySelector('.booking-success');
  if (!root) return;

  const urlParams = new URLSearchParams(window.location.search);
  const sid = urlParams.get('sid');
  const pendingCard = root.querySelector('.booking-success__card--pending');
  const providerKey = root.dataset.provider || 'stripe';
  const providerName = root.dataset.providerName || 'Stripe';

  if (sid && pendingCard) {
    pollBookingStatus(sid, providerKey, providerName);
  }

  initCountdownRedirect();
};
