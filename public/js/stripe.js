/* eslint-disable */
import axios from "axios"
import { showAlert } from "./alerts"
import { loadStripe } from "@stripe/stripe-js";

// Đảm bảo cung cấp API key Stripe một cách chính xác
export const bookTour = async (tourId, startDate, participants) => {
  try {
    // Hiển thị thông báo đang xử lý
    const bookBtn = document.getElementById("book-tour")
    if (bookBtn) bookBtn.textContent = "Đang xử lý..."

    // 1) Kiểm tra tham số
    if (!startDate) {
      const startDateInput = document.getElementById("startDate")
      startDate = startDateInput ? startDateInput.value : null

      if (!startDate) {
        if (bookBtn) bookBtn.textContent = "Thanh toán ngay"
        return showAlert("error", "Vui lòng chọn ngày khởi hành")
      }
    }

    if (!participants) {
      const participantsInput = document.getElementById("participants")
      participants = participantsInput ? Number.parseInt(participantsInput.value, 10) : 1
    }

    // 2) Lấy phiên checkout từ API
    const session = await axios.get(
      `/api/v1/bookings/checkout-session/${tourId}?startDate=${startDate}&participants=${participants}`,
    )

    // 3) Tạo phiên thanh toán + chuyển hướng đến trang thanh toán
    const stripe = await loadStripe(
      "pk_test_51ROK1zPQRbfkcMyySxeH7DJx96qGXiuqvM1wzDle8ZUt00OlrjxqHoQQsxvqF6aq2jPQCXkQqPaAlL593dJilC3c00rXElE12Q"
    )
    
    if (!stripe) {
      throw new Error("Không thể khởi tạo Stripe")
    }
    
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    })
  } catch (err) {
    console.error(err)
    showAlert("error", err.response?.data?.message || "Có lỗi xảy ra, vui lòng thử lại.")

    // Khôi phục nút thanh toán
    const bookBtn = document.getElementById("book-tour")
    if (bookBtn) bookBtn.textContent = "Thanh toán ngay"
  }
}

// Đặt hàm bookTour vào window object để có thể gọi từ inline script
window.bookTour = bookTour