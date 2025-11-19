/* eslint-disable */
import axios from "axios";
import { showAlert } from "./alerts";

const collectPromotionFormData = () => ({
  name: document.getElementById("promo-name").value.trim(),
  code: document.getElementById("promo-code").value.trim().toUpperCase(),
  description: document.getElementById("promo-description").value.trim(),
  discountType: document.getElementById("discountType").value,
  discountValue: Number.parseFloat(
    document.getElementById("discountValue").value
  ),
  maxDiscountAmount: Number.parseInt(
    document.getElementById("maxDiscountAmount").value || "0",
    10
  ),
  minOrderAmount: Number.parseInt(
    document.getElementById("minOrderAmount").value || "0",
    10
  ),
  startDate: document.getElementById("startDate").value || undefined,
  endDate: document.getElementById("endDate").value || undefined,
  usageLimit: Number.parseInt(
    document.getElementById("usageLimit").value || "0",
    10
  ),
  perUserLimit: Number.parseInt(
    document.getElementById("perUserLimit").value || "1",
    10
  ),
  status: document.getElementById("status").value
});

export const handlePromotionForm = () => {
  const form = document.querySelector(".form-promotion");
  if (!form) return;

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Đang lưu...";
    }
    const promoId = document.getElementById("promotion-id").value;
    const payload = collectPromotionFormData();

    try {
      if (!payload.name || !payload.code) {
        throw new Error("Vui lòng nhập tên và mã khuyến mãi.");
      }
      const url = promoId
        ? `/api/v1/promotions/${promoId}`
        : "/api/v1/promotions";
      const method = promoId ? "patch" : "post";
      await axios({ method, url, data: payload });
      showAlert("success", "Đã lưu khuyến mãi thành công!");
      setTimeout(() => {
        window.location.href = "/admin/promotions";
      }, 1200);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.message ||
        "Không thể lưu khuyến mãi.";
      showAlert("error", message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = promoId ? "Cập nhật khuyến mãi" : "Tạo khuyến mãi";
      }
    }
  });
};

export const handlePromotionAssignForm = () => {
  const form = document.querySelector(".form-assign-promotion");
  if (!form) return;

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Đang gắn mã...";
    }
    const promoId = document.getElementById("assign-promotion-id").value;
    const assignUserSelect = document.getElementById("assign-user");
    const selectedUserIds = Array.from(assignUserSelect?.selectedOptions || [])
      .map(option => option.value)
      .filter(Boolean);
    const usageLimit = Number.parseInt(
      document.getElementById("assign-limit").value || "1",
      10
    );
    const expiresAt = document.getElementById("assign-expiry").value;
    const note = document.getElementById("assign-note").value.trim();

    if (!selectedUserIds.length) {
      showAlert("error", "Vui lòng chọn người dùng.");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Gắn mã cho user";
      }
      return;
    }

    try {
      await axios.post(`/api/v1/promotions/${promoId}/assign`, {
        userIds: selectedUserIds,
        userId: selectedUserIds[0],
        usageLimit,
        expiresAt: expiresAt || undefined,
        note
      });
      showAlert("success", "Đã gắn mã cho user!");
      setTimeout(() => {
        window.location.href = "/admin/promotions";
      }, 900);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Không thể gắn mã. Vui lòng thử lại.";
      showAlert("error", message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Gắn mã cho user";
      }
    }
  });
};

export const initPromotionListActions = () => {
  document.querySelectorAll(".btn-delete-promotion").forEach(btn => {
    btn.addEventListener("click", async () => {
      const promoId = btn.dataset.promoId;
      if (!promoId) return;
      const confirmed = window.confirm(
        "Xác nhận xóa khuyến mãi? Những dữ liệu đã sử dụng sẽ được lưu trữ."
      );
      if (!confirmed) return;
      btn.disabled = true;
      try {
        await axios.delete(`/api/v1/promotions/${promoId}`);
        showAlert("success", "Đã xóa/ẩn khuyến mãi.");
        setTimeout(() => window.location.reload(), 900);
      } catch (err) {
        const message =
          err.response?.data?.message || "Không thể xóa khuyến mãi.";
        showAlert("error", message);
        btn.disabled = false;
      }
    });
  });
};
