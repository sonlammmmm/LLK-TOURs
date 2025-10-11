/* eslint-disable */
import axios from "axios";
import { showAlert } from "./alerts";

// === STRIPE PAYMENT FUNCTION ===
export const bookTour = async (tourId, startDate, participants) => {
  try {
    console.log("💳 [Stripe] Gửi yêu cầu tạo phiên thanh toán...");
    const session = await axios(
      `/api/v1/bookings/checkout-session/${tourId}?startDate=${encodeURIComponent(
        startDate
      )}&participants=${participants}`
    );
    console.log("✅ [Stripe] Redirect đến:", session.data.session.url);
    window.location.replace(session.data.session.url);
  } catch (err) {
    console.error("❌ Stripe booking error:", err);
    showAlert("error", "Không thể tạo phiên thanh toán Stripe!");
  }
};

// === MAIN INITIALIZER ===
export const initBookingForm = () => {
  console.log("🚀 bookingForm.js đã được load thành công");

  const bookTourBtn = document.getElementById("book-tour");
  const dateButtons = document.querySelectorAll(".booking-date-btn");
  const participantInput = document.getElementById("participants-input");
  const participantDisplay = document.getElementById("participants-number");

  let selectedDate = null;
  let currentParticipants = 1;

  // === CHỌN NGÀY KHỞI HÀNH ===
  if (dateButtons.length > 0) {
    dateButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        dateButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        selectedDate = btn.dataset.date;
        console.log("📅 Đã chọn ngày:", selectedDate);
        bookTourBtn.disabled = false;
      });
    });
  } else {
    console.warn("⚠️ Không tìm thấy nút chọn ngày (.booking-date-btn)");
  }

  // === TĂNG / GIẢM SỐ NGƯỜI ===
  const decreaseBtn = document.querySelector(".decrease-btn");
  const increaseBtn = document.querySelector(".increase-btn");

  if (decreaseBtn && increaseBtn && participantDisplay) {
    decreaseBtn.addEventListener("click", () => {
      if (currentParticipants > 1) {
        currentParticipants--;
        participantDisplay.textContent = currentParticipants;
        participantInput.value = currentParticipants;
      }
      console.log("👥 Giảm số người:", currentParticipants);
    });

    increaseBtn.addEventListener("click", () => {
      currentParticipants++;
      participantDisplay.textContent = currentParticipants;
      participantInput.value = currentParticipants;
      console.log("👥 Tăng số người:", currentParticipants);
    });
  } else {
    console.warn("⚠️ Không tìm thấy nút tăng/giảm người tham gia");
  }

  // === NÚT THANH TOÁN ===
  if (bookTourBtn) {
    bookTourBtn.addEventListener("click", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const form = this.closest("form");
      const selectedRadio = form
        ? form.querySelector('input[name="paymentMethod"]:checked')
        : null;
      const selectedPayment = selectedRadio ? selectedRadio.value : "stripe";

      console.log("🎯 Phương thức thanh toán được chọn:", selectedPayment);

      const tourId = this.dataset.tourId;

      if (!selectedDate) {
        showAlert("error", "Vui lòng chọn ngày khởi hành trước khi thanh toán!");
        console.warn("⚠️ Chưa chọn ngày khởi hành, dừng xử lý");
        return;
      }

      bookTourBtn.disabled = true;
      const originalText = bookTourBtn.textContent;
      bookTourBtn.textContent = "Đang xử lý...";

      try {
        if (selectedPayment === "vnpay") {
          console.log("💰 [VNPAY] Đang tạo URL thanh toán...");
          const res = await fetch(
            `/api/v1/bookings/create-vnpay-url?tourId=${tourId}&startDate=${encodeURIComponent(
              selectedDate
            )}&participants=${currentParticipants}`
          );

          const data = await res.json();
          console.log("📦 [VNPAY] Phản hồi:", data);

          if (data.status === "success" && data.paymentUrl) {
            console.log("✅ [VNPAY] Redirect đến:", data.paymentUrl);
            window.location.href = data.paymentUrl;
          } else {
            showAlert("error", "Không thể tạo liên kết thanh toán VNPAY!");
            console.error("❌ [VNPAY] Không có paymentUrl hợp lệ:", data);
          }
        } else {
          console.log("💳 [Stripe] Xử lý thanh toán Stripe...");
          await bookTour(tourId, selectedDate, currentParticipants);
        }
      } catch (err) {
        console.error("❌ Lỗi khi xử lý thanh toán:", err);
        showAlert("error", "Đã xảy ra lỗi khi thanh toán!");
      } finally {
        bookTourBtn.disabled = false;
        bookTourBtn.textContent = originalText;
      }
    });
  } else {
    console.warn("⚠️ Không tìm thấy nút #book-tour");
  }
};

// === KÍCH HOẠT SAU KHI DOM SẴN SÀNG ===
document.addEventListener("DOMContentLoaded", () => {
  initBookingForm();
});
