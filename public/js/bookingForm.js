/* eslint-disable */
import axios from "axios"
import { showAlert } from "./alerts"
import { loadStripe } from '@stripe/stripe-js';

// Đảm bảo cung cấp API key Stripe một cách chính xác
const stripePromise = loadStripe(
  "pk_test_51ROK1zPQRbfkcMyySxeH7DJx96qGXiuqvM1wzDle8ZUt00OlrjxqHoQQsxvqF6aq2jPQCXkQqPaAlL593dJilC3c00rXElE12Q",
)

export const initBookingForm = () => {
  const participantsInput = document.getElementById("participants")
  const totalPriceElement = document.getElementById("total-price")
  const decreaseBtn = document.querySelector(".booking-form-btn--decrease")
  const increaseBtn = document.querySelector(".booking-form-btn--increase")
  const bookTourBtn = document.getElementById("book-tour")
  const startDateInput = document.getElementById("startDate") // Thêm lấy input startDate

  if (!participantsInput || !totalPriceElement) return

  // Lấy giá gốc từ text và chuyển đổi thành số
  const priceText = document.querySelector(".booking-form-price").textContent
  const tourPrice = Number.parseInt(priceText.replace(/[^\d]/g, ""), 10)

  // Hàm cập nhật tổng tiền
  const updateTotalPrice = () => {
    const participants = Number.parseInt(participantsInput.value, 10) || 1
    const totalPrice = tourPrice * participants
    totalPriceElement.textContent = `${totalPrice.toLocaleString("vi-VN")} VND`
  }

  // Cập nhật tính toán khi thay đổi số lượng người
  participantsInput.addEventListener("input", updateTotalPrice)

  // Xử lý nút giảm số lượng
  if (decreaseBtn) {
    decreaseBtn.addEventListener("click", () => {
      const currentValue = Number.parseInt(participantsInput.value, 10) || 1
      if (currentValue > 1) {
        participantsInput.value = currentValue - 1
        updateTotalPrice()
      }
    })
  }

  // Xử lý nút tăng số lượng
  if (increaseBtn) {
    increaseBtn.addEventListener("click", () => {
      const currentValue = Number.parseInt(participantsInput.value, 10) || 1
      const maxSize = bookTourBtn.dataset.maxSize
      if (currentValue < maxSize) {
        participantsInput.value = currentValue + 1
        updateTotalPrice()
      }
    })
  }

  // Xử lý nút đặt tour
  if (bookTourBtn) {
    bookTourBtn.addEventListener("click", async (e) => {
      e.preventDefault()
      bookTourBtn.textContent = "Đang xử lý..."

      try {
        const tourId = bookTourBtn.dataset.tourId
        const participants = Number.parseInt(participantsInput.value, 10) || 1
        const maxSize = bookTourBtn.dataset.maxSize
        
        // Kiểm tra ngày khởi hành đã được chọn chưa
        if (!startDateInput || !startDateInput.value) {
          bookTourBtn.textContent = "Thanh toán ngay"
          return showAlert("error", "Vui lòng chọn ngày khởi hành")
        }
        
        const startDate = startDateInput.value

        // Kiểm tra ràng buộc số lượng người
        if (participants > maxSize) {
          bookTourBtn.textContent = "Thanh toán ngay"
          return showAlert("error", `Số lượng người tham gia tối đa là ${maxSize} người`)
        }

        if (participants < 1) {
          bookTourBtn.textContent = "Thanh toán ngay"
          return showAlert("error", "Số lượng người tham gia tối thiểu là 1 người")
        }

        // Lấy phiên checkout từ API của server
        const sessionResponse = await axios.get(
          `/api/v1/bookings/checkout-session/${tourId}?startDate=${startDate}&participants=${participants}`,
        )

        // Chờ đợi Stripe được tải xong
        const stripe = await stripePromise
        if (!stripe) {
          throw new Error("Stripe không khởi tạo được!")
        }

        // Redirect đến trang checkout
        const result = await stripe.redirectToCheckout({
          sessionId: sessionResponse.data.session.id,
        })

        if (result.error) {
          console.error(result.error)
          showAlert("error", result.error.message)
          bookTourBtn.textContent = "Thanh toán ngay"
        }
      } catch (err) {
        console.error(err)
        showAlert("error", err.response ? err.response.data.message : "Đã xảy ra lỗi khi đặt tour")
        bookTourBtn.textContent = "Thanh toán ngay"
      }
    })
  }
}