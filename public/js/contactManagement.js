/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

const reloadAfter = (delay) => {
  setTimeout(() => window.location.reload(), delay);
};

// Gửi form liên hệ (public)
export const initContactForm = () => {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('contactSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';

    const data = {
      name: document.getElementById('contact-name').value.trim(),
      email: document.getElementById('contact-email').value.trim(),
      phone: document.getElementById('contact-phone').value.trim() || undefined,
      subject: document.getElementById('contact-subject').value.trim(),
      message: document.getElementById('contact-message').value.trim(),
    };

    try {
      if (!data.name || !data.email || !data.subject || !data.message) {
        throw new Error('Vui lòng điền đầy đủ các trường bắt buộc.');
      }

      await axios.post('/api/v1/contacts', data);
      showAlert('success', 'Tin nhắn đã được gửi thành công! Chúng tôi sẽ phản hồi sớm nhất.');
      form.reset();
      form.classList.add('contact-form--sent');
      submitBtn.innerHTML = '<i class="fas fa-check"></i> Đã gửi thành công';
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Không thể gửi tin nhắn. Vui lòng thử lại.';
      showAlert('error', message);
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi tin nhắn';
    }
  });
};

// Admin: quản lý hòm thư
export const initContactManagement = () => {
  const inbox = document.querySelector('.contact-inbox');
  if (!inbox) return;

  // Đánh dấu đã đọc
  document.querySelectorAll('.btn-mark-read').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const msgId = btn.dataset.msgId;
      if (!msgId) return;
      btn.disabled = true;

      try {
        await axios.patch(`/api/v1/contacts/${msgId}/read`);
        // Chuyển card từ unread → read ngay lập tức
        const card = btn.closest('.contact-card');
        if (card) {
          card.classList.remove('contact-card--unread');
          card.dataset.read = 'read';

          // Cập nhật avatar icon
          const avatar = card.querySelector('.contact-card__avatar i');
          if (avatar) {
            avatar.className = 'fas fa-envelope-open';
          }

          // Cập nhật badge
          const badge = card.querySelector('.contact-card__badge');
          if (badge) {
            badge.textContent = 'Đã đọc';
            badge.classList.add('contact-card__badge--read');
          }

          // Ẩn nút đánh dấu
          btn.remove();
        }

        showAlert('success', 'Đã đánh dấu đã đọc.');
      } catch (err) {
        const message = err.response?.data?.message || 'Không thể cập nhật.';
        showAlert('error', message);
        btn.disabled = false;
      }
    });
  });

  // Xóa tin nhắn
  document.querySelectorAll('.btn-delete-contact').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const msgId = btn.dataset.msgId;
      if (!msgId) return;
      const confirmed = window.confirm('Bạn có chắc muốn xóa tin nhắn này?');
      if (!confirmed) return;
      btn.disabled = true;

      try {
        await axios.delete(`/api/v1/contacts/${msgId}`);
        showAlert('success', 'Đã xóa tin nhắn.');
        reloadAfter(900);
      } catch (err) {
        const message = err.response?.data?.message || 'Không thể xóa tin nhắn.';
        showAlert('error', message);
        btn.disabled = false;
      }
    });
  });
};
