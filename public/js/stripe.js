/* eslint-disable */
import axios from './vendor/axios.js';
import { loadStripe } from './vendor/stripe.js';
import { showAlert } from './alerts.js';

const showError = message => {
  if (typeof showAlert === 'function') {
    showAlert('error', message);
  } else {
    console.error('[Stripe Error]', message);
    alert(message);
  }
};

const resetButton = bookBtn => {
  if (bookBtn) {
    bookBtn.textContent = 'Book tour now'; // Hoặc 'Pay now' tùy text gốc
    bookBtn.disabled = false;
  }
};

const getStripePublicKey = () => {
  if (typeof window === 'undefined') return '';
  // Đảm bảo bạn đã truyền biến này từ server xuống view (base.pug)
  return window.STRIPE_PUBLIC_KEY || '';
};

const readStartDateFromDom = () => {
  const startDateInput =
    document.getElementById('selectedDate') || document.getElementById('startDate');
  return startDateInput ? startDateInput.value : null;
};

const readParticipantsFromDom = () => {
  const participantsInput =
    document.getElementById('participants-input') || document.getElementById('participants');
  const value = participantsInput ? Number.parseInt(participantsInput.value, 10) : 1;
  return Number.isNaN(value) ? 1 : value;
};

const createCheckoutSession = async (tourId, payload) => {
  console.log('[Stripe Client] Sending request:', payload);
  try {
    const response = await axios.post(
      `/api/v1/bookings/checkout-session/${tourId}`,
      payload,
      { timeout: 30000 }
    );
    
    console.log('[Stripe Client] Response received:', response.data);
    
    if (!response.data || response.data.status !== 'success') {
      throw new Error(response.data?.message || 'Unable to create a payment session.');
    }
    
    return response.data.session;
  } catch (err) {
    // Ném lỗi ra ngoài để hàm bookTour xử lý
    throw err;
  }
};

export const bookTour = async (
  tourId,
  startDate,
  participants,
  selectedServices,
  promotionCode
) => {
  const bookBtn = document.getElementById('book-tour');

  try {
    // 1. UI Feedback
    if (bookBtn) {
      bookBtn.textContent = 'Processing...';
      bookBtn.disabled = true;
    }

    // 2. Get Data
    if (!startDate) {
      startDate = readStartDateFromDom();
    }

    if (!participants) {
      participants = readParticipantsFromDom();
    }

    // 3. Validate Data
    if (!startDate || startDate === 'null' || startDate === 'undefined') {
      showError('Vui lòng chọn ngày khởi hành trước khi thanh toán.');
      resetButton(bookBtn);
      return;
    }

    if (!tourId) {
      showError('Không tìm thấy thông tin tour.');
      resetButton(bookBtn);
      return;
    }

    const payload = {
      startDate,
      participants,
      selectedServices: selectedServices || [],
      promotionCode,
      platform: 'web'
    };

    console.log('[Stripe] Creating checkout session', payload);

    // 4. Call API
    const session = await createCheckoutSession(tourId, payload);

    // 5. Handle Redirection
    
    // CÁCH 1 (KHUYÊN DÙNG): Redirect bằng URL từ Server
    // Stripe Session trả về 'url' để redirect trực tiếp tới trang thanh toán hosted
    if (session.url) {
      console.log('[Stripe] Redirecting directly using session URL:', session.url);
      window.location.href = session.url;
      return;
    }

    // CÁCH 2 (FALLBACK): Dùng SDK Client-side
    // Chỉ chạy vào đây nếu server không trả về URL (ít khi xảy ra với Checkout Session mới)
    console.log('[Stripe] Session URL not found, falling back to Stripe SDK');

    if (!session || !session.id) {
      throw new Error('Payment session is invalid (No Session ID).');
    }

    const stripeKey = getStripePublicKey();
    if (!stripeKey) {
      throw new Error('Stripe Public Key chưa được cấu hình (kiểm tra config.env và base.pug).');
    }

    const stripe = await loadStripe(stripeKey);
    if (!stripe) {
      throw new Error('Unable to load Stripe.js SDK.');
    }

    console.log('[Stripe] Redirecting with SDK...');
    window.redirectingToStripe = true;
    
    const result = await stripe.redirectToCheckout({ sessionId: session.id });
    
    if (result.error) {
        throw new Error(result.error.message);
    }

  } catch (err) {
    if (window.redirectingToStripe) {
      console.log('[Stripe] Redirect already in progress, ignoring error.');
      return;
    }

    console.error('[Stripe] Checkout error:', err);
    
    let errorMessage = 'Đã xảy ra lỗi khi tạo phiên thanh toán. Vui lòng thử lại.';

    if (err.response?.data?.message) {
      errorMessage = err.response.data.message;
    } else if (err.response?.status === 401) {
      errorMessage = 'Bạn cần đăng nhập để tiếp tục thanh toán.';
    } else if (err.message) {
      errorMessage = err.message;
    }

    showError(errorMessage);
    resetButton(bookBtn);
  }
};

// Gán vào window để đảm bảo tương thích với các code cũ gọi qua onclick HTML
window.bookTour = bookTour;