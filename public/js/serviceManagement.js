/* eslint-disable */
import axios from "axios";
import { showAlert } from "./alerts";

const parseNumber = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const collectServiceFormData = () => {
  const allowMultiple = document.getElementById("allowMultiple");
  return {
    name: document.getElementById("name").value.trim(),
    code: document.getElementById("code").value.trim() || undefined,
    shortDescription: document
      .getElementById("shortDescription")
      .value.trim(),
    description: document.getElementById("description").value.trim(),
    price: parseNumber(document.getElementById("price").value, 0),
    chargeType: document.getElementById("chargeType").value,
    allowMultiple: allowMultiple ? allowMultiple.checked : false,
    minQuantity: parseNumber(document.getElementById("minQuantity").value, 1),
    maxQuantity: parseNumber(document.getElementById("maxQuantity").value, 1),
    visibility: document.getElementById("visibility").value,
    status: document.getElementById("status").value,
    displayOrder: parseNumber(
      document.getElementById("displayOrder").value,
      0
    )
  };
};

export const handleServiceForm = () => {
  const form = document.querySelector(".form-service");
  if (!form) return;

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const submitBtn = form.querySelector("button[type='submit']");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Đang lưu...";
    }
    const serviceId = document.getElementById("service-id").value;
    const data = collectServiceFormData();

    try {
      if (!data.name || !data.price) {
        throw new Error("Vui lòng nhập tên và giá dịch vụ.");
      }

      const url = serviceId
        ? `/api/v1/services/${serviceId}`
        : "/api/v1/services";
      const method = serviceId ? "patch" : "post";
      await axios({ method, url, data });
      showAlert("success", "Đã lưu dịch vụ thành công!");
      setTimeout(() => {
        window.location.href = "/admin/services";
      }, 1200);
    } catch (err) {
      const message =
        err.response?.data?.message || "Không thể lưu dịch vụ. Vui lòng thử lại.";
      showAlert("error", message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = serviceId ? "Cập nhật dịch vụ" : "Tạo dịch vụ";
      }
    }
  });
};

const reloadAfter = delay => {
  setTimeout(() => window.location.reload(), delay);
};

export const initServiceListActions = () => {
  const toggleButtons = document.querySelectorAll(".btn-toggle-service");
  toggleButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const serviceId = btn.dataset.serviceId;
      if (!serviceId) return;
      btn.disabled = true;
      try {
        await axios.patch(`/api/v1/services/${serviceId}/toggle`);
        showAlert("success", "Đã cập nhật trạng thái dịch vụ.");
        reloadAfter(900);
      } catch (err) {
        const message =
          err.response?.data?.message || "Không thể cập nhật dịch vụ.";
        showAlert("error", message);
        btn.disabled = false;
      }
    });
  });

  const deleteButtons = document.querySelectorAll(".btn-delete-service");
  deleteButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const serviceId = btn.dataset.serviceId;
      if (!serviceId) return;
      const confirmed = window.confirm(
        "Bạn có chắc muốn xóa dịch vụ này? Dịch vụ đã phát sinh giao dịch sẽ được chuyển sang trạng thái ẩn."
      );
      if (!confirmed) return;
      btn.disabled = true;
      try {
        await axios.delete(`/api/v1/services/${serviceId}`);
        showAlert("success", "Đã xóa dịch vụ.");
        reloadAfter(900);
      } catch (err) {
        const message =
          err.response?.data?.message ||
          "Không thể xóa dịch vụ. Có thể dịch vụ đã phát sinh giao dịch.";
        showAlert("error", message);
        btn.disabled = false;
      }
    });
  });
};
