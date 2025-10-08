/* eslint-disable */
import axios from "axios"
import { showAlert } from "./alerts"

export const forgotPassword = async (email) => {
  try {
    // Hiển thị thông báo đang xử lý
    showAlert("info", "Đang gửi email đặt lại mật khẩu...")

    const res = await axios({
      method: "POST",
      url: "/api/v1/users/forgotPassword",
      data: {
        email,
      },
    })

    if (res.data.status === "success") {
      showAlert("success", "Liên kết đặt lại mật khẩu đã được gửi đến email của bạn!")
      window.setTimeout(() => {
        location.assign("/me")
      }, 3000)
    }
  } catch (err) {
    console.error("Lỗi khi gửi yêu cầu đặt lại mật khẩu:", err)
    showAlert("error", err.response?.data?.message || "Có lỗi xảy ra khi gửi email. Vui lòng thử lại sau.")
  }
}

export const resetPassword = async (password, passwordConfirm, token) => {
  try {
    // Kiểm tra mật khẩu và xác nhận mật khẩu
    if (password !== passwordConfirm) {
      return showAlert("error", "Mật khẩu và xác nhận mật khẩu không khớp!")
    }

    // Hiển thị thông báo đang xử lý
    showAlert("info", "Đang đặt lại mật khẩu...")

    const res = await axios({
      method: "PATCH",
      url: `/api/v1/users/resetPassword/${token}`,
      data: {
        password,
        passwordConfirm,
      },
    })

    if (res.data.status === "success") {
      showAlert("success", "Mật khẩu đã được đặt lại thành công!")
      window.setTimeout(() => {
        location.assign("/login")
      }, 1500)
    }
  } catch (err) {
    console.error("Lỗi khi đặt lại mật khẩu:", err)

    // Hiển thị lỗi chi tiết
    const errorMsg = err.response?.data?.message || "Có lỗi xảy ra khi đặt lại mật khẩu. Vui lòng thử lại."
    showAlert("error", errorMsg)

    // Hiển thị lỗi trong container
    const errorContainer = document.querySelector(".error-container")
    const errorMessage = document.querySelector(".error-message")

    if (errorContainer && errorMessage) {
      errorContainer.classList.remove("hidden")
      errorMessage.textContent = errorMsg
    }
  }
}
