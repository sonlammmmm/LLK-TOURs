/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alerts';

export const initSiteSettingsManagement = () => {
  const form = document.getElementById('siteSettingsForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('settingsSaveBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

    // Thu thập tất cả dữ liệu từ form
    const data = {
      address: document.getElementById('settings-address').value.trim(),
      phone: document.getElementById('settings-phone').value.trim(),
      email: document.getElementById('settings-email').value.trim(),
      hotline: document.getElementById('settings-hotline').value.trim(),
      businessLicense: document.getElementById('settings-businessLicense').value.trim(),
      licenseNote: document.getElementById('settings-licenseNote').value.trim(),
      socialFacebook: document.getElementById('settings-socialFacebook').value.trim(),
      socialInstagram: document.getElementById('settings-socialInstagram').value.trim(),
      socialYoutube: document.getElementById('settings-socialYoutube').value.trim(),
      socialTiktok: document.getElementById('settings-socialTiktok').value.trim(),
      socialGithub: document.getElementById('settings-socialGithub').value.trim(),
      brandDescription: document.getElementById('settings-brandDescription').value.trim(),
      brandHighlights: document.getElementById('settings-brandHighlights').value.trim(),
      ctaTitle: document.getElementById('settings-ctaTitle').value.trim(),
      ctaDescription: document.getElementById('settings-ctaDescription').value.trim(),
    };

    try {
      await axios.patch('/api/v1/site-settings', data);
      showAlert('success', 'Đã cập nhật cài đặt website thành công!');
    } catch (err) {
      const message =
        err.response?.data?.message || err.message || 'Không thể lưu cài đặt.';
      showAlert('error', message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-save"></i> Lưu cài đặt';
    }
  });
};
