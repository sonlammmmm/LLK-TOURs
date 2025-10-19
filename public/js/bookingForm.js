/* eslint-disable */
import axios from "axios";
import { showAlert } from "./alerts";

// === STRIPE PAYMENT FUNCTION ===
export const bookTour = async (tourId, startDate, participants) => {
  try {
    const session = await axios(
      `/api/v1/bookings/checkout-session/${tourId}?startDate=${encodeURIComponent(
        startDate
      )}&participants=${participants}&platform=web` // <-- thêm platform=web
    );
    window.location.replace(session.data.session.url);
  } catch (err) {
    console.error("❌ Stripe booking error:", err);
    showAlert("error", "Không thể tạo phiên thanh toán Stripe!");
  }
};

export const initBookingForm = () => {
  const bookTourBtn = document.getElementById("book-tour");
  const dateButtons = document.querySelectorAll(".booking-date-btn");
  const participantInput = document.getElementById("participants-input");
  const participantNumber = document.getElementById("participants-number"); // cột trái
  const participantsDisplay = document.getElementById("participants-display"); // cột phải
  const totalPriceEl = document.getElementById("total-price");
  const pricePerPersonEl = document.getElementById("price-per-person");

  if (!bookTourBtn || !participantInput || !participantNumber || !participantsDisplay || !pricePerPersonEl || !totalPriceEl) {
    return;
  }

  let selectedDate = null;
  let currentParticipants = parseInt(participantInput.value || '1', 10);
  let isProcessing = false;

  const maxSize = parseInt(bookTourBtn.dataset.maxSize, 10) || 1;

  const parseCurrency = (el) =>
    parseInt(String(el.textContent || '').replace(/[^\d]/g, ''), 10) || 0;

  const updateParticipantsUI = () => {
    participantNumber.textContent = currentParticipants;
    participantsDisplay.textContent = currentParticipants;
    participantInput.value = currentParticipants;
  };

  const updateTotal = () => {
    const unit = parseCurrency(pricePerPersonEl);
    const total = unit * currentParticipants;
    totalPriceEl.textContent = `${(total || 0).toLocaleString("vi-VN")} ₫`;
  };

  if (dateButtons.length > 0) {
    dateButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        dateButtons.forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedDate = btn.dataset.date;
        bookTourBtn.disabled = false;
        showAlert("success", "Đã chọn ngày khởi hành");
      });
    });
  }

  const decreaseBtn = document.querySelector(".decrease-btn");
  const increaseBtn = document.querySelector(".increase-btn");

  if (decreaseBtn) {
    decreaseBtn.addEventListener("click", () => {
      if (currentParticipants > 1) {
        currentParticipants--;
        updateParticipantsUI();
        updateTotal();
      } else {
        showAlert("error", "Tối thiểu 1 người tham gia");
      }
    });
  }

  if (increaseBtn) {
    increaseBtn.addEventListener("click", () => {
      if (currentParticipants < maxSize) {
        currentParticipants++;
        updateParticipantsUI();
        updateTotal();
      } else {
        showAlert("error", `Không vượt quá ${maxSize} người!`);
      }
    });
  }

  participantInput.addEventListener("input", () => {
    const val = parseInt(participantInput.value || '1', 10);
    currentParticipants = Math.min(Math.max(val || 1, 1), maxSize);
    updateParticipantsUI();
    updateTotal();
  });

  updateParticipantsUI();
  updateTotal();

  bookTourBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    if (isProcessing) return;
    isProcessing = true;

    const form = bookTourBtn.closest("form");
    const selectedRadio = form ? form.querySelector('input[name="paymentMethod"]:checked') : null;
    const selectedPayment = selectedRadio ? selectedRadio.value : null;
    const tourId = bookTourBtn.dataset.tourId;

    if (!selectedDate) {
      showAlert("error", "Vui lòng chọn ngày khởi hành!");
      isProcessing = false;
      return;
    }
    if (!selectedPayment) {
      showAlert("error", "Vui lòng chọn phương thức thanh toán!");
      isProcessing = false;
      return;
    }

    const originalText = bookTourBtn.textContent;
    bookTourBtn.disabled = true;
    bookTourBtn.textContent = "Đang xử lý...";

    try {
      if (selectedPayment === "vnpay") {
        const res = await fetch(
          `/api/v1/bookings/create-vnpay-url?tourId=${tourId}&startDate=${encodeURIComponent(
            selectedDate
          )}&participants=${currentParticipants}`
        );
        const data = await res.json();

        if (data?.status === "success" && data?.paymentUrl) {
          showAlert("success", "Đang chuyển hướng đến VNPAY...");
          window.location.href = data.paymentUrl;
        } else {
          showAlert("error", "Không thể tạo liên kết thanh toán VNPAY!");
        }
      } else {
        await bookTour(tourId, selectedDate, currentParticipants);
      }
    } catch (err) {
      console.error("❌ Lỗi thanh toán:", err);
      showAlert("error", "Đã xảy ra lỗi khi thanh toán!");
    } finally {
      isProcessing = false;
      bookTourBtn.disabled = false;
      bookTourBtn.textContent = originalText;
    }
  });
};

document.addEventListener("DOMContentLoaded", () => {
  initBookingForm();
});
