/* eslint-disable */

// Polling để kiểm tra booking đã được tạo chưa
const pollBookingStatus = async (sid) => {
  if (!sid) return;

  const maxAttempts = 30; // 30 lần
  const interval = 2000; // 2 giây
  let attempts = 0;

  const checkStatus = async () => {
    try {
      attempts++;
      console.log(`[POLL] Checking booking status (${attempts}/${maxAttempts})...`);

      const res = await fetch(`/api/v1/bookings/by-session/${sid}`);
      const data = await res.json();

      if (data.status === 'success' && data.data) {
        console.log('[POLL] ✅ Booking found!', data.data);
        
        // Reload trang để hiển thị thông tin booking
        window.location.reload();
        return;
      }

      // Nếu chưa có booking và còn attempt
      if (attempts < maxAttempts) {
        setTimeout(checkStatus, interval);
      } else {
        console.log('[POLL] ❌ Timeout - booking not found after 30 attempts');
        
        // Hiển thị thông báo lỗi
        const pendingMsg = document.querySelector('.booking-success__pending');
        if (pendingMsg) {
          pendingMsg.innerHTML = `
            <h2>⚠️ Có vấn đề xảy ra</h2>
            <p>Chúng tôi không thể xác nhận booking của bạn sau khi thanh toán.</p>
            <p>Vui lòng liên hệ với chúng tôi hoặc kiểm tra lại trong phần "Tour của tôi".</p>
            <a href="/my-tours" class="btn btn--green">Xem tour của tôi</a>
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

  // Bắt đầu polling sau 1 giây
  setTimeout(checkStatus, 1000);
};

// Tự động chạy khi trang load
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const sid = urlParams.get('sid');
  const isPending = document.querySelector('.booking-success__pending');

  if (sid && isPending) {
    console.log('[POLL] Starting polling for session:', sid);
    pollBookingStatus(sid);
  }
});