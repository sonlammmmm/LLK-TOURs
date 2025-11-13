/* eslint-disable */
import axios from "axios";
import { showAlert } from "./alerts";

const parseCurrency = el =>
  parseInt(String(el.textContent || "").replace(/[^\d]/g, ""), 10) || 0;

const formatCurrency = value =>
  `${(value || 0).toLocaleString("vi-VN")} ₫`;

const readBookingData = () => {
  const node = document.getElementById("booking-data");
  if (!node) return {};
  try {
    return JSON.parse(node.textContent || "{}");
  } catch {
    return {};
  }
};

const bookingData = readBookingData();
const availableServices = bookingData.services || [];

const matchId = value => (value ? String(value) : '');
const getServiceById = id =>
  availableServices.find(
    service =>
      matchId(service.id) === matchId(id) ||
      matchId(service._id) === matchId(id)
  );

const ensureServiceRecord = (serviceId, sourceEl) => {
  let service = getServiceById(serviceId);
  if (service) return service;

  const fallbackEl =
    sourceEl ||
    document.querySelector(
      `.service-checkbox[data-service-id="${matchId(serviceId)}"]`
    );
  if (!fallbackEl) return null;

  const ds = fallbackEl.dataset || {};
  service = {
    id: matchId(serviceId),
    price: Number(ds.price || 0) || 0,
    chargeType: ds.chargeType || "per-person",
    allowMultiple:
      String(ds.allowMultiple || "").toLowerCase() === "true",
    minQuantity: parseInt(ds.minQuantity || "1", 10) || 1,
    maxQuantity:
      parseInt(ds.maxQuantity || ds.minQuantity || "1", 10) || 1,
    name: ds.name || "Dịch vụ bổ sung"
  };
  availableServices.push(service);
  return service;
};

const formatSelectedDate = value => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return "";
  }
};

export const bookTour = async (
  tourId,
  startDate,
  participants,
  selectedServices,
  promotionCode
) => {
  try {
    const session = await axios.post(
      `/api/v1/bookings/checkout-session/${tourId}`,
      {
        startDate,
        participants,
        selectedServices,
        promotionCode,
        platform: "web"
      }
    );
    window.location.replace(session.data.session.url);
  } catch (err) {
    console.error("Stripe booking error:", err);
    const message =
      err.response?.data?.message ||
      "Không thể tạo phiên thanh toán Stripe!";
    showAlert("error", message);
    throw err;
  }
};

export const initBookingForm = () => {
  const bookTourBtn = document.getElementById("book-tour");
  const dateButtons = document.querySelectorAll(".booking-date-btn");
  const participantInput = document.getElementById("participants-input");
  const participantNumber = document.getElementById("participants-number");
  const participantsDisplay = document.getElementById("participants-display");
  const pricePerPersonEl = document.getElementById("price-per-person");
  const servicesTotalEl = document.getElementById("services-total");
  const discountAmountEl = document.getElementById("discount-amount");
  const grandTotalEl = document.getElementById("grand-total");
  const promotionInput = document.getElementById("promotion-code");
  const applyPromoBtn = document.getElementById("apply-promo");
  const removePromoBtn = document.getElementById("remove-promo");
  const promotionMessage = document.getElementById("promotion-message");
  const selectedDateLabel = document.getElementById("selected-date-label");
  const selectedDateSlots = document.getElementById("selected-date-slots");
  const participantsRemaining = document.getElementById("participants-remaining");

  if (
    !bookTourBtn ||
    !participantInput ||
    !participantNumber ||
    !participantsDisplay ||
    !pricePerPersonEl ||
    !servicesTotalEl ||
    !discountAmountEl ||
    !grandTotalEl
  ) {
    return;
  }

  let selectedDate = null;
  let currentParticipants = parseInt(participantInput.value || "1", 10);
  const maxSize = parseInt(bookTourBtn.dataset.maxSize, 10) || 1;
  let isProcessing = false;
  let isApplyingPromotion = false;

  const state = {
    selectedServices: new Map(),
    discountAmount: 0,
    promotionCode: null
  };

  const setSelectedDateMeta = (value, slots) => {
    if (selectedDateLabel) {
      selectedDateLabel.textContent = value
        ? formatSelectedDate(value)
        : "Chưa chọn";
    }
    if (selectedDateSlots) {
      if (typeof slots === "number" && !Number.isNaN(slots)) {
        selectedDateSlots.textContent =
          slots > 1 ? `${slots} chỗ còn trống` : "1 chỗ cuối";
      } else {
        selectedDateSlots.textContent = "Chưa xác định";
      }
    }
  };

  const updateParticipantMeta = () => {
    if (participantsRemaining) {
      const remaining = Math.max(maxSize - currentParticipants, 0);
      participantsRemaining.textContent =
        remaining === 0 ? "0 chỗ" : `${remaining} chỗ`;
    }
  };

  setSelectedDateMeta(null);

  const getSelectedServicesPayload = () =>
    Array.from(state.selectedServices.values()).map(item => ({
      serviceId: item.serviceId,
      quantity: item.quantity
    }));

  const resetPromotion = (reason = "") => {
    state.discountAmount = 0;
    state.promotionCode = null;
    if (promotionInput) promotionInput.value = "";
    if (promotionMessage) {
      promotionMessage.textContent = reason || "";
      promotionMessage.classList.remove("promo-message--error");
    }
    if (removePromoBtn) {
      removePromoBtn.hidden = true;
      removePromoBtn.disabled = true;
    }
  };

  const updateTotals = () => {
    const unit = parseCurrency(pricePerPersonEl);
    const baseTotal = unit * currentParticipants;
    let servicesTotal = 0;

    state.selectedServices.forEach(selection => {
      const service = getServiceById(selection.serviceId);
      if (!service) return;
      const quantity =
        service.chargeType === "per-person"
          ? currentParticipants
          : selection.quantity || 1;
      servicesTotal += Number(service.price || 0) * quantity;
    });

    state.servicesTotal = servicesTotal;
    const subtotal = baseTotal + servicesTotal;
    const discount = Math.min(state.discountAmount || 0, subtotal);
    const grandTotal = subtotal - discount;

    servicesTotalEl.textContent = formatCurrency(servicesTotal);
    discountAmountEl.textContent =
      discount > 0 ? `- ${formatCurrency(discount)}` : formatCurrency(0);
    grandTotalEl.textContent = formatCurrency(grandTotal);
  };


  const refreshPromotionIfNeeded = async () => {
    if (!state.promotionCode) {
      updateTotals();
      return;
    }
    try {
      await applyPromotion(state.promotionCode, { silent: true });
    } catch {
      resetPromotion('Mã khuyến mãi đã được gỡ do thay đổi giá dịch vụ.');
      updateTotals();
    }
  };

  const handleServiceSelection = checkbox => {
    const { serviceId } = checkbox.dataset;
    const service = ensureServiceRecord(serviceId, checkbox);
    if (!service) return;

    const quantityInput = document.querySelector(
      `input.service-quantity-input[data-service-id="${serviceId}"]`
    );

    if (checkbox.checked) {
      const quantity =
        service.chargeType === 'per-person'
          ? currentParticipants
          : service.allowMultiple && quantityInput
            ? Math.max(
                parseInt(quantityInput.value || '1', 10) ||
                  service.minQuantity ||
                  1,
                service.minQuantity || 1
              )
            : 1;
      state.selectedServices.set(serviceId, { serviceId, quantity });
      if (quantityInput) {
        quantityInput.disabled = false;
      }
    } else {
      state.selectedServices.delete(serviceId);
      if (quantityInput) {
        quantityInput.disabled = true;
      }
    }
    updateTotals();
    refreshPromotionIfNeeded();
  };

  const handleQuantityChange = (input, serviceId) => {
    const service = ensureServiceRecord(serviceId);
    if (!service) return;
    const min = parseInt(input.min || '1', 10) || 1;
    const max =
      parseInt(input.max || String(Number.MAX_SAFE_INTEGER), 10) ||
      Number.MAX_SAFE_INTEGER;
    let value = parseInt(input.value || '1', 10) || min;
    value = Math.min(Math.max(value, min), max);
    input.value = value;
    if (state.selectedServices.has(serviceId)) {
      state.selectedServices.set(serviceId, { serviceId, quantity: value });
      updateTotals();
      refreshPromotionIfNeeded();
    }
  };


  const applyPromotion = async (code, { silent } = {}) => {
    const trimmed = (code || "").trim().toUpperCase();
    if (!trimmed) {
      if (!silent) showAlert("error", "Vui lòng nhập mã hợp lệ.");
      return;
    }
    if (isApplyingPromotion) return;
    isApplyingPromotion = true;
    if (applyPromoBtn) {
      applyPromoBtn.disabled = true;
      applyPromoBtn.textContent = "Đang kiểm tra...";
    }
    if (promotionMessage) {
      promotionMessage.textContent = "";
      promotionMessage.classList.remove("promo-message--error");
    }
    try {
      const res = await axios.post("/api/v1/promotions/preview", {
        tourId: bookTourBtn.dataset.tourId,
        participants: currentParticipants,
        selectedServices: getSelectedServicesPayload(),
        promotionCode: trimmed
      });
      const data = res.data.data;
      state.discountAmount = data?.discountAmount || 0;
      state.promotionCode = trimmed;
      if (promotionMessage) {
        promotionMessage.textContent = data?.promotion
          ? `Đã áp dụng mã ${trimmed}.`
          : `Ưu đãi được cập nhật.`;
      }
      if (removePromoBtn) {
        removePromoBtn.hidden = false;
        removePromoBtn.disabled = false;
      }
      updateTotals();
      if (!silent) {
        showAlert("success", `Áp dụng mã ${trimmed} thành công!`);
      }
    } catch (err) {
      state.discountAmount = 0;
      state.promotionCode = null;
      const message =
        err.response?.data?.message || "Mã khuyến mãi không hợp lệ.";
      if (promotionMessage) {
        promotionMessage.textContent = message;
        promotionMessage.classList.add("promo-message--error");
      }
      if (!silent) showAlert("error", message);
      throw err;
    } finally {
      isApplyingPromotion = false;
      if (applyPromoBtn) {
        applyPromoBtn.disabled = false;
        applyPromoBtn.textContent = "Áp dụng";
      }
    }
  };

  if (dateButtons.length > 0) {
    dateButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        dateButtons.forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedDate = btn.dataset.date;
        const slots = parseInt(btn.dataset.slots || "0", 10);
        setSelectedDateMeta(
          selectedDate,
          Number.isNaN(slots) ? undefined : slots
        );
        bookTourBtn.disabled = false;
        showAlert("success", "Đã chọn ngày khởi hành");
      });
    });
  }

  const decreaseBtn = document.querySelector(".decrease-btn");
  const increaseBtn = document.querySelector(".increase-btn");

  const updateParticipantsUI = () => {
    participantNumber.textContent = currentParticipants;
    participantsDisplay.textContent = currentParticipants;
    participantInput.value = currentParticipants;
    updateParticipantMeta();
  };

  const updatePerPersonServices = () => {
    state.selectedServices.forEach(selection => {
      const service = ensureServiceRecord(selection.serviceId);
      if (service && service.chargeType === "per-person") {
        state.selectedServices.set(selection.serviceId, {
          serviceId: selection.serviceId,
          quantity: currentParticipants
        });
      }
    });
  };

  if (decreaseBtn) {
    decreaseBtn.addEventListener("click", () => {
      if (currentParticipants > 1) {
        currentParticipants -= 1;
        updateParticipantsUI();
        updatePerPersonServices();
        updateTotals();
        refreshPromotionIfNeeded();
      } else {
        showAlert("error", "Tối thiểu 1 người tham gia");
      }
    });
  }

  if (increaseBtn) {
    increaseBtn.addEventListener("click", () => {
      if (currentParticipants < maxSize) {
        currentParticipants += 1;
        updateParticipantsUI();
        updatePerPersonServices();
        updateTotals();
        refreshPromotionIfNeeded();
      } else {
        showAlert("error", `Không vượt quá ${maxSize} người!`);
      }
    });
  }

  participantInput.addEventListener("input", () => {
    const val = parseInt(participantInput.value || "1", 10);
    currentParticipants = Math.min(Math.max(val || 1, 1), maxSize);
    updateParticipantsUI();
    updatePerPersonServices();
    updateTotals();
    refreshPromotionIfNeeded();
  });

  document
    .querySelectorAll(".service-checkbox")
    .forEach(checkbox =>
      checkbox.addEventListener("change", () =>
        handleServiceSelection(checkbox)
      )
    );

  document.querySelectorAll(".service-quantity-input").forEach(input => {
    input.addEventListener("input", () =>
      handleQuantityChange(input, input.dataset.serviceId)
    );
  });

  document.querySelectorAll(".promo-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      if (promotionInput) {
        promotionInput.value = chip.dataset.code || "";
        promotionInput.focus();
      }
    });
  });

  if (applyPromoBtn && promotionInput) {
    applyPromoBtn.addEventListener("click", async () => {
      if (!selectedDate) {
        showAlert("error", "Vui lòng chọn ngày khởi hành trước.");
        return;
      }
      try {
        await applyPromotion(promotionInput.value);
      } catch {
        // handled inside
      }
    });
  }

  if (removePromoBtn) {
    removePromoBtn.addEventListener("click", () => {
      resetPromotion("Đã bỏ mã khuyến mãi.");
      updateTotals();
    });
  }

  updateParticipantsUI();
  updateTotals();

  bookTourBtn.addEventListener("click", async e => {
    e.preventDefault();
    if (isProcessing) return;
    if (!selectedDate) {
      showAlert("error", "Vui lòng chọn ngày khởi hành!");
      return;
    }

    const tourId = bookTourBtn.dataset.tourId;
    const originalText = bookTourBtn.textContent;
    bookTourBtn.disabled = true;
    bookTourBtn.textContent = "Đang xử lý...";
    isProcessing = true;

    try {
      await bookTour(
        tourId,
        selectedDate,
        currentParticipants,
        getSelectedServicesPayload(),
        state.promotionCode
      );
    } catch {
      // error already surfaced
    } finally {
      bookTourBtn.disabled = false;
      bookTourBtn.textContent = originalText;
      isProcessing = false;
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
  initBookingForm();
});
