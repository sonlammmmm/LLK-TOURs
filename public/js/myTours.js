/* eslint-disable */
import axios from "axios"
import { showAlert } from "./alerts"

// Thêm đánh giá mới
export const addReview = async (tourId, reviewData) => {
  try {
    console.log("Adding review for tour ID:", tourId)
    const url = `/api/v1/tours/${tourId}/reviews`

    const res = await axios({
      method: "POST",
      url,
      data: reviewData,
    })

    if (res.data.status === "success") {
      showAlert("success", "Đánh giá đã được gửi thành công!")
      window.setTimeout(() => {
        location.reload()
      }, 1500)
    }
  } catch (err) {
    console.error("Error adding review:", err)
    showAlert("error", err.response ? err.response.data.message : "Đã xảy ra lỗi khi gửi đánh giá")
  }
}

// Cập nhật đánh giá
export const updateReview = async (reviewId, reviewData) => {
  try {
    console.log("Updating review with ID:", reviewId)
    const url = `/api/v1/reviews/${reviewId}`

    const res = await axios({
      method: "PATCH",
      url,
      data: reviewData,
    })

    if (res.data.status === "success") {
      showAlert("success", "Đánh giá đã được cập nhật thành công!")
      window.setTimeout(() => {
        location.reload()
      }, 1500)
    }
  } catch (err) {
    console.error("Error updating review:", err)
    showAlert("error", err.response ? err.response.data.message : "Đã xảy ra lỗi khi cập nhật đánh giá")
  }
}

// Xử lý thêm và chỉnh sửa đánh giá
export const handleAddReview = () => {
  const addReviewButtons = document.querySelectorAll(".btn-add-review")
  const editReviewButtons = document.querySelectorAll(".btn-edit-my-review")
  const modal = document.getElementById("review-modal")
  const closeBtn = document.querySelector(".modal__close")
  const form = document.querySelector(".form-add-review")
  const reviewTourIdInput = document.getElementById("review-tour-id")
  const reviewIdInput = document.getElementById("review-id")
  const isEditInput = document.getElementById("is-edit")
  const reviewTextInput = document.getElementById("review-text")
  const ratingInputs = document.querySelectorAll('input[name="rating"]')
  const modalTitle = document.querySelector(".modal__title")
  const submitButton = document.querySelector(".btn-save-review")

  // Mở modal khi nhấn nút thêm đánh giá
  addReviewButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const button = e.target.closest('.btn-add-review')
      const tourId = button.dataset.tourId
      console.log("Add review button clicked for tour ID:", tourId)

      // Điền thông tin vào form
      reviewTourIdInput.value = tourId
      reviewIdInput.value = ""
      isEditInput.value = "false"
      reviewTextInput.value = ""
      ratingInputs.forEach((input) => {
        input.checked = false
      })

      // Cập nhật tiêu đề và nút
      modalTitle.textContent = "Đánh giá tour"
      submitButton.textContent = "Gửi đánh giá"

      // Hiển thị modal
      modal.classList.remove("hidden")
    })
  })

  // Mở modal khi nhấn nút chỉnh sửa đánh giá
  editReviewButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const button = e.target.closest('.btn-edit-my-review')
      const reviewId = button.dataset.reviewId
      const tourId = button.dataset.tourId
      const reviewText = button.dataset.reviewText
      const reviewRating = button.dataset.reviewRating
      
      console.log("Edit review button clicked for review ID:", reviewId)
      console.log("Data attributes:", {
        reviewId,
        tourId,
        reviewText,
        reviewRating
      })

      if (!reviewId || !tourId || reviewText === undefined || reviewRating === undefined) {
        console.error("Missing data attributes:", {
          reviewId,
          tourId,
          reviewText,
          reviewRating
        })
        showAlert("error", "Không thể lấy thông tin đánh giá. Vui lòng thử lại!")
        return
      }

      // Điền thông tin vào form
      reviewTourIdInput.value = tourId
      reviewIdInput.value = reviewId
      isEditInput.value = "true"
      reviewTextInput.value = reviewText

      // Chọn rating
      ratingInputs.forEach((input) => {
        if (Number.parseInt(input.value, 10) === Number.parseInt(reviewRating, 10)) {
          input.checked = true
        }
      })

      // Cập nhật tiêu đề và nút
      modalTitle.textContent = "Chỉnh sửa đánh giá"
      submitButton.textContent = "Cập nhật đánh giá"

      // Hiển thị modal
      modal.classList.remove("hidden")
    })
  })

  // Đóng modal khi nhấn nút đóng
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      modal.classList.add("hidden")
    })
  }

  // Đóng modal khi nhấn bên ngoài
  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden")
    }
  })

  // Xử lý submit form
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault()
      const saveButton = document.querySelector(".btn-save-review")
      const originalButtonText = saveButton.textContent
      saveButton.textContent = "Đang xử lý..."
      saveButton.disabled = true

      try {
        const tourId = reviewTourIdInput.value
        const reviewId = reviewIdInput.value
        const isEdit = isEditInput.value === "true"
        const reviewText = reviewTextInput.value
        let rating = 5 // Mặc định 5 sao

        // Lấy giá trị rating đã chọn
        ratingInputs.forEach((input) => {
          if (input.checked) {
            rating = Number.parseInt(input.value, 10)
          }
        })

        const reviewData = {
          review: reviewText,
          rating: rating,
        }

        if (isEdit) {
          await updateReview(reviewId, reviewData)
        } else {
          await addReview(tourId, reviewData)
        }
        modal.classList.add("hidden")
      } catch (err) {
        console.error("Error in form submission:", err)
        showAlert("error", err.message || "Đã xảy ra lỗi khi xử lý đánh giá")
      } finally {
        saveButton.textContent = originalButtonText
        saveButton.disabled = false
      }
    })
  }
}

// In hóa đơn
export const handlePrintInvoice = () => {
  const printButton = document.querySelector(".btn-print-invoice")

  if (printButton) {
    printButton.addEventListener("click", () => {
      window.print()
    })
  }
}