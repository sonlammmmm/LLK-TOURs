/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

const reloadAfter = (delay) => {
  setTimeout(() => window.location.reload(), delay);
};

// ===== MODAL HELPERS =====
const openModal = () => {
  document.getElementById('faqModal').classList.add('is-open');
};

const closeModal = () => {
  document.getElementById('faqModal').classList.remove('is-open');
  document.getElementById('faqForm').reset();
  document.getElementById('faq-edit-id').value = '';
  document.getElementById('faqModalTitle').textContent = 'Thêm câu hỏi mới';
  document.getElementById('faqSubmitBtn').textContent = 'Lưu câu hỏi';
};

// ===== FORM SUBMIT =====
const handleFaqForm = () => {
  const form = document.getElementById('faqForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('faqSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang lưu...';

    const faqId = document.getElementById('faq-edit-id').value;
    const data = {
      question: document.getElementById('faq-question').value.trim(),
      answer: document.getElementById('faq-answer').value.trim(),
      displayOrder: parseInt(document.getElementById('faq-order').value, 10) || 0,
    };

    try {
      if (!data.question || !data.answer) {
        throw new Error('Vui lòng nhập câu hỏi và câu trả lời.');
      }

      const url = faqId ? `/api/v1/faqs/${faqId}` : '/api/v1/faqs';
      const method = faqId ? 'patch' : 'post';
      await axios({ method, url, data });
      showAlert('success', faqId ? 'Đã cập nhật câu hỏi!' : 'Đã thêm câu hỏi mới!');
      closeModal();
      reloadAfter(900);
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Không thể lưu câu hỏi.';
      showAlert('error', message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = faqId ? 'Cập nhật' : 'Lưu câu hỏi';
    }
  });
};

// ===== INIT =====
export const initFaqManagement = () => {
  const faqTable = document.querySelector('.faq-table');
  if (!faqTable) return;

  // Add button
  const addBtn = document.getElementById('btn-add-faq');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      closeModal();
      document.getElementById('faqModalTitle').textContent = 'Thêm câu hỏi mới';
      document.getElementById('faqSubmitBtn').textContent = 'Lưu câu hỏi';
      openModal();
    });
  }

  // Close modal buttons
  const closeBtn = document.getElementById('faqModalClose');
  const cancelBtn = document.getElementById('faqCancelBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  // Close on overlay click
  const overlay = document.getElementById('faqModal');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Form submit
  handleFaqForm();

  // Edit buttons
  document.querySelectorAll('.btn-edit-faq').forEach((btn) => {
    btn.addEventListener('click', () => {
      const { faqId, question, answer, order } = btn.dataset;
      document.getElementById('faq-edit-id').value = faqId;
      document.getElementById('faq-question').value = question || '';
      document.getElementById('faq-answer').value = answer || '';
      document.getElementById('faq-order').value = order || '0';
      document.getElementById('faqModalTitle').textContent = 'Chỉnh sửa câu hỏi';
      document.getElementById('faqSubmitBtn').textContent = 'Cập nhật';
      openModal();
    });
  });

  // Toggle buttons
  document.querySelectorAll('.btn-toggle-faq').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const faqId = btn.dataset.faqId;
      if (!faqId) return;
      btn.disabled = true;
      try {
        await axios.patch(`/api/v1/faqs/${faqId}/toggle`);
        showAlert('success', 'Đã cập nhật trạng thái.');
        reloadAfter(900);
      } catch (err) {
        const message = err.response?.data?.message || 'Không thể cập nhật.';
        showAlert('error', message);
        btn.disabled = false;
      }
    });
  });

  // Delete buttons
  document.querySelectorAll('.btn-delete-faq').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const faqId = btn.dataset.faqId;
      if (!faqId) return;
      const confirmed = window.confirm('Bạn có chắc muốn xóa câu hỏi này?');
      if (!confirmed) return;
      btn.disabled = true;
      try {
        await axios.delete(`/api/v1/faqs/${faqId}`);
        showAlert('success', 'Đã xóa câu hỏi.');
        reloadAfter(900);
      } catch (err) {
        const message = err.response?.data?.message || 'Không thể xóa câu hỏi.';
        showAlert('error', message);
        btn.disabled = false;
      }
    });
  });
};
