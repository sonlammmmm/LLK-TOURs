/* eslint-disable */
import axios from "./vendor/axios.js";
import { showAlert } from "./alerts.js";

const parseCurrency = el =>
  parseInt(String(el.textContent || "").replace(/[^\d]/g, ""), 10) || 0;

const formatCurrency = value =>
  `${(value || 0).toLocaleString("vi-VN")} VND`;

const readBookingData = () => {
  const node = document.getElementById("booking-data");
  if (!node) return {};
  try {
    return JSON.parse(node.textContent || "{}");
  } catch (err) {
    console.error("Failed to parse booking payload", err);
    return {};
  }
};

const bookingData = readBookingData();
const availableServices = bookingData.services || [];

const normalizeId = value => (value ? String(value) : "");

const getServiceById = id =>
  availableServices.find(
    service =>
      normalizeId(service.id) === normalizeId(id) ||
      normalizeId(service._id) === normalizeId(id)
  );

const ensureServiceRecord = (serviceId, sourceEl) => {
  const normalizedId = normalizeId(serviceId);
  if (!normalizedId) return null;
  let service = getServiceById(normalizedId);
  if (service) return service;

  const fallbackEl =
    sourceEl ||
    document.querySelector(
      `.service-checkbox[data-service-id="${normalizedId}"]`
    );
  if (!fallbackEl) return null;

  const ds = fallbackEl.dataset || {};
  service = {
    id: normalizedId,
    price: Number(ds.price || 0) || 0,
    chargeType: ds.chargeType || "per-person",
    allowMultiple: String(ds.allowMultiple || "").toLowerCase() === "true",
    minQuantity: parseInt(ds.minQuantity || "1", 10) || 1,
    maxQuantity:
      parseInt(ds.maxQuantity || ds.minQuantity || "1", 10) || 1,
    name: ds.name || "Dich vu khuyen mai"
  };
  availableServices.push(service);
  return service;
};

const formatSelectedDate = value => {
  if (!value) return "Chua chon";
  try {
    return new Date(value).toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return "Chua chon";
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
  if (typeof window !== "undefined") {
    if (window.__llkBookingFormInitialized) return;
    window.__llkBookingFormInitialized = true;
  }
  const bookTourBtn = document.getElementById("book-tour");
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
  const participantsDateDisplay = document.getElementById(
    "participants-date-display"
  );
  const participantsSeatsRemaining = document.getElementById(
    "participants-remaining"
  );
  const selectedDateInput = document.getElementById("selectedDate");
  const dateButtons = Array.from(
    document.querySelectorAll(".booking-date-btn")
  );
  const serviceCheckboxes = Array.from(
    document.querySelectorAll(".service-checkbox")
  );
  const quantityInputs = Array.from(
    document.querySelectorAll(".service-quantity-input")
  );
  const promoChips = Array.from(document.querySelectorAll(".promo-chip"));
  const decreaseBtn = document.querySelector(".decrease-btn");
  const increaseBtn = document.querySelector(".increase-btn");

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

  const maxSize = parseInt(bookTourBtn.dataset.maxSize, 10) || 1;

  const state = {
    selectedDate: null,
    selectedSlots: null,
    currentParticipants:
      Math.max(parseInt(participantInput.value || "1", 10) || 1, 1),
    selectedServices: new Map(),
    discountAmount: 0,
    promotionCode: null,
    isProcessing: false,
    isApplyingPromotion: false
  };

  const selectedDateMetaText = value =>
    value ? formatSelectedDate(value) : "Chưa chọn";

  const getSlotLimit = () => {
    if (
      typeof state.selectedSlots === "number" &&
      !Number.isNaN(state.selectedSlots)
    ) {
      return Math.min(maxSize, state.selectedSlots);
    }
    return maxSize;
  };

  const updateParticipantMeta = () => {
    if (!participantsSeatsRemaining) return;
    if (state.selectedSlots === null) {
      participantsSeatsRemaining.textContent = "";
      return;
    }
    const remaining = Math.max(getSlotLimit() - state.currentParticipants, 0);
    participantsSeatsRemaining.textContent =
      remaining === 0 ? "0 cho" : `${remaining} cho`;
  };

  const updateParticipantsUI = () => {
    participantNumber.textContent = state.currentParticipants;
    participantsDisplay.textContent = state.currentParticipants;
    participantInput.value = state.currentParticipants;
    updateParticipantMeta();
  };

  const persistSelectedDate = value => {
    if (selectedDateInput) {
      selectedDateInput.value = value || "";
    }
  };

  const setSelectedDateMeta = (value, slots) => {
    const formatted = selectedDateMetaText(value);
    if (selectedDateLabel) selectedDateLabel.textContent = formatted;
    if (participantsDateDisplay)
      participantsDateDisplay.textContent = formatted;
    if (selectedDateSlots) {
      if (typeof slots === "number" && !Number.isNaN(slots)) {
        selectedDateSlots.textContent =
          slots > 1 ? `${slots} cho con trong` : "1 cho cuoi";
      } else {
        selectedDateSlots.textContent = "Chua xac dinh";
      }
    }
    state.selectedDate = value;
    persistSelectedDate(value);
    if (typeof slots === "number" && !Number.isNaN(slots)) {
      state.selectedSlots = slots;
    } else {
      state.selectedSlots = null;
    }
    state.currentParticipants = Math.min(
      state.currentParticipants,
      getSlotLimit()
    );
    updateParticipantsUI();
    bookTourBtn.disabled = !value;
  };

  const getSelectedServicesPayload = () =>
    Array.from(state.selectedServices.values()).map(item => ({
      serviceId: item.serviceId,
      quantity: item.quantity
    }));

  const updateTotals = () => {
    const baseValue = parseCurrency(pricePerPersonEl);
    const baseTotal = baseValue * state.currentParticipants;
    let servicesTotal = 0;

    state.selectedServices.forEach(selection => {
      const service = ensureServiceRecord(selection.serviceId);
      if (!service) return;
      const quantity =
        service.chargeType === "per-person"
          ? state.currentParticipants
          : selection.quantity || 1;
      servicesTotal += Number(service.price || 0) * quantity;
    });

    const subtotal = baseTotal + servicesTotal;
    const discount = Math.min(state.discountAmount || 0, subtotal);
    const grandTotal = subtotal - discount;

    servicesTotalEl.textContent = formatCurrency(servicesTotal);
    discountAmountEl.textContent =
      discount > 0 ? `- ${formatCurrency(discount)}` : formatCurrency(0);
    grandTotalEl.textContent = formatCurrency(grandTotal);
  };

  const resetPromotion = (reason = "") => {
    state.discountAmount = 0;
    state.promotionCode = null;
    if (promotionInput) promotionInput.value = "";
    if (promotionMessage) {
      promotionMessage.textContent = reason;
      promotionMessage.classList.remove("promo-message--error");
    }
    if (removePromoBtn) {
      removePromoBtn.hidden = true;
      removePromoBtn.disabled = true;
    }
    updateTotals();
  };

  const refreshPromotionIfNeeded = async () => {
    if (!state.promotionCode) {
      updateTotals();
      return;
    }
    try {
      await applyPromotion(state.promotionCode, { silent: true });
    } catch {
      resetPromotion(
        "Mã khuyến mãi này không hợp lệ hoặc đã hết hạn."
      );
    }
  };

  const updatePerPersonServices = () => {
    state.selectedServices.forEach(selection => {
      const service = ensureServiceRecord(selection.serviceId);
      if (service && service.chargeType === "per-person") {
        state.selectedServices.set(selection.serviceId, {
          serviceId: selection.serviceId,
          quantity: state.currentParticipants
        });
      }
    });
  };

  const handleServiceSelection = checkbox => {
    const { serviceId } = checkbox.dataset;
    const service = ensureServiceRecord(serviceId, checkbox);
    if (!service) return;

    const quantityInput = document.querySelector(
      `input.service-quantity-input[data-service-id="${serviceId}"]`
    );

    if (checkbox.checked) {
      let quantity = 1;
      if (service.chargeType === "per-person") {
        quantity = state.currentParticipants;
      } else if (service.allowMultiple && quantityInput) {
        const min = Math.max(service.minQuantity || 1, 1);
        const value = parseInt(quantityInput.value || String(min), 10) || min;
        quantity = Math.min(
          Math.max(value, min),
          service.maxQuantity || Number.MAX_SAFE_INTEGER
        );
        quantityInput.disabled = false;
        quantityInput.value = quantity;
      }
      state.selectedServices.set(serviceId, { serviceId, quantity });
    } else {
      state.selectedServices.delete(serviceId);
      if (quantityInput) quantityInput.disabled = true;
    }

    updateTotals();
    refreshPromotionIfNeeded();
  };

  const handleQuantityChange = input => {
    const serviceId = input.dataset.serviceId;
    const service = ensureServiceRecord(serviceId);
    if (!service) return;
    const min = parseInt(input.min || "1", 10) || 1;
    const max =
      parseInt(input.max || String(Number.MAX_SAFE_INTEGER), 10) ||
      Number.MAX_SAFE_INTEGER;
    let value = parseInt(input.value || String(min), 10) || min;
    value = Math.min(Math.max(value, min), max);
    input.value = value;
    if (state.selectedServices.has(serviceId)) {
      state.selectedServices.set(serviceId, { serviceId, quantity: value });
      updateTotals();
      refreshPromotionIfNeeded();
    }
  };

  const applyPromotion = async (code, { silent = false } = {}) => {
    const trimmed = (code || "").trim().toUpperCase();
    if (!trimmed) {
      if (!silent) showAlert("error", "Vui lòng nhập mã khuyến mãi.");
      return;
    }
    if (state.isApplyingPromotion) return;
    state.isApplyingPromotion = true;
    if (applyPromoBtn) {
      applyPromoBtn.disabled = true;
      applyPromoBtn.textContent = "Đang áp dụng...";
    }
    if (promotionMessage) {
      promotionMessage.textContent = "";
      promotionMessage.classList.remove("promo-message--error");
    }

    try {
      const res = await axios.post("/api/v1/promotions/preview", {
        tourId: bookTourBtn.dataset.tourId,
        participants: state.currentParticipants,
        selectedServices: getSelectedServicesPayload(),
        promotionCode: trimmed
      });
      const data = res.data.data;
      state.discountAmount = data?.discountAmount || 0;
      state.promotionCode = trimmed;
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
        err.response?.data?.message || "Mã khuyến mãi không hợp lệ!";
      if (promotionMessage) {
        promotionMessage.textContent = message;
        promotionMessage.classList.add("promo-message--error");
      }
      if (!silent) showAlert("error", message);
      throw err;
    } finally {
      state.isApplyingPromotion = false;
      if (applyPromoBtn) {
        applyPromoBtn.disabled = false;
        applyPromoBtn.textContent = "Áp dụng";
      }
    }
  };

  const selectDateButton = button => {
    dateButtons.forEach(b => b.classList.remove("selected"));
    button.classList.add("selected");
    const rawDate = button.dataset.date;
    const slots =
      typeof button.dataset.slots !== "undefined"
        ? parseInt(button.dataset.slots, 10)
        : 0;
    setSelectedDateMeta(
      rawDate,
      Number.isNaN(slots) ? undefined : slots
    );
  };

  if (dateButtons.length > 0) {
    dateButtons.forEach(button =>
      button.addEventListener("click", () => selectDateButton(button))
    );
  }

  if (decreaseBtn) {
    decreaseBtn.addEventListener("click", () => {
      if (state.currentParticipants > 1) {
        state.currentParticipants -= 1;
        updateParticipantsUI();
        updatePerPersonServices();
        updateTotals();
        refreshPromotionIfNeeded();
      } else {
        showAlert("error", "Tối thiểu 1 khách.");
      }
    });
  }

  if (increaseBtn) {
    increaseBtn.addEventListener("click", () => {
      const limit = getSlotLimit();
      if (state.currentParticipants < limit) {
        state.currentParticipants += 1;
        updateParticipantsUI();
        updatePerPersonServices();
        updateTotals();
        refreshPromotionIfNeeded();
      } else {
        showAlert("error", `Chỉ còn ${limit} chỗ cho ngày đã chọn.`);
      }
    });
  }

  participantInput.addEventListener("input", () => {
    const limit = getSlotLimit();
    const val = parseInt(participantInput.value || "1", 10) || 1;
    state.currentParticipants = Math.min(Math.max(val, 1), limit);
    updateParticipantsUI();
    updatePerPersonServices();
    updateTotals();
    refreshPromotionIfNeeded();
  });

  serviceCheckboxes.forEach(checkbox => {
    checkbox.addEventListener("change", () => handleServiceSelection(checkbox));
  });

  quantityInputs.forEach(input => {
    input.addEventListener("input", () => handleQuantityChange(input));
  });

  promoChips.forEach(chip => {
    chip.addEventListener("click", () => {
      if (promotionInput) {
        promotionInput.value = chip.dataset.code || "";
        promotionInput.focus();
      }
    });
  });

  if (applyPromoBtn && promotionInput) {
    applyPromoBtn.addEventListener("click", async () => {
      if (!state.selectedDate) {
        showAlert("error", "Vui lòng chọn ngày khởi hành trước.");
        return;
      }
      try {
        await applyPromotion(promotionInput.value);
      } catch {
        // error already shown
      }
    });
  }

  if (removePromoBtn) {
    removePromoBtn.addEventListener("click", () => {
      resetPromotion("Đã gỡ mã khuyến mãi.");
    });
  }

  updateParticipantsUI();
  updateTotals();
  setSelectedDateMeta(null);

  bookTourBtn.disabled = true;

  bookTourBtn.addEventListener("click", async e => {
    e.preventDefault();
    if (state.isProcessing) return;
    if (!state.selectedDate) {
      showAlert("error", "Vui lòng chọn ngày khởi hành!");
      return;
    }
    const tourId = bookTourBtn.dataset.tourId;
    const originalText = bookTourBtn.textContent;
    bookTourBtn.disabled = true;
    bookTourBtn.textContent = "Đang xử lý...";
    state.isProcessing = true;

    try {
      await bookTour(
        tourId,
        state.selectedDate,
        state.currentParticipants,
        getSelectedServicesPayload(),
        state.promotionCode
      );
    } catch {
      // error already surfaced
    } finally {
      bookTourBtn.disabled = false;
      bookTourBtn.textContent = originalText;
      state.isProcessing = false;
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
  initBookingForm();
});
