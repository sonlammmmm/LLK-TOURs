/* eslint-disable */
import axios from "axios";
import { loadStripe } from "@stripe/stripe-js";

export const bookTour = async (tourId, startDate, participants) => {
  try {
    const bookBtn = document.getElementById("book-tour");
    if (bookBtn) bookBtn.textContent = "Đang xử lý...";

    // Lấy startDate nếu chưa có (từ hidden/input)
    if (!startDate) {
      const startDateInput =
        document.getElementById("selectedDate") ||
        document.getElementById("startDate");
      startDate = startDateInput ? startDateInput.value : null;
    }

    // Lấy participants nếu chưa có (từ hidden/input)
    if (!participants) {
      const participantsInput =
        document.getElementById("participants-input") ||
        document.getElementById("participants");
      participants = participantsInput
        ? Number.parseInt(participantsInput.value, 10)
        : 1;
    }

    // Nếu chưa có ngày → KHÔNG alert, chỉ khóa nút & dừng lại
    if (!startDate || startDate === "null" || startDate === "undefined") {
      if (bookBtn) {
        bookBtn.textContent = "Thanh toán ngay";
        bookBtn.disabled = true;
      }
      console.warn("[Stripe] startDate is missing -> stop silently");
      return;
    }

    // Tạo session
    const sessionRes = await axios.get(
      `/api/v1/bookings/checkout-session/${tourId}` +
      `?startDate=${encodeURIComponent(startDate)}` +
      `&participants=${participants}` +
      `&platform=web`
    );

    const session = sessionRes?.data?.session;
    if (!session) {
      // Không alert – chỉ log
      console.error("[Stripe] No valid session received");
      if (bookBtn) {
        bookBtn.textContent = "Thanh toán ngay";
        bookBtn.disabled = false;
      }
      return;
    }

    // Khởi tạo Stripe và redirect
    const stripe = await loadStripe(
      "pk_test_51ROK1zPQRbfkcMyySxeH7DJx96qGXiuqvM1wzDle8ZUt00OlrjxqHoQQsxvqF6aq2jPQCXkQqPaAlL593dJilC3c00rXElE12Q"
    );
    if (!stripe) {
      console.error("[Stripe] Cannot init Stripe");
      if (bookBtn) {
        bookBtn.textContent = "Thanh toán ngay";
        bookBtn.disabled = false;
      }
      return;
    }

    // Đặt cờ để bỏ qua mọi xử lý lỗi phát sinh trong lúc chuyển trang
    window.redirectingToStripe = true;

    await stripe.redirectToCheckout({ sessionId: session.id });
  } catch (err) {
    // Nếu đang redirect, bỏ qua hết
    if (window.redirectingToStripe) return;

    // Không hiển thị alert – chỉ log & khôi phục nút nếu có
    console.error("[Stripe] Checkout error:", err);

    const bookBtn = document.getElementById("book-tour");
    if (bookBtn) {
      bookBtn.textContent = "Thanh toán ngay";
      bookBtn.disabled = false;
    }
  }
};

// Gắn vào window để bookingForm.js gọi
window.bookTour = bookTour;
