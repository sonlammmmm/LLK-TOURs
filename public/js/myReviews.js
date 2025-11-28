/* eslint-disable */
import axios from "axios"
import { showAlert } from "./alerts"

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

// Xóa đánh giá
export const deleteReview = async (reviewId) => {
  try {
    console.log("Deleting review with ID:", reviewId)
    const url = `/api/v1/reviews/${reviewId}`

    const res = await axios({
      method: "DELETE",
      url,
    })

    if (res.status === 204) {
      showAlert("success", "Đánh giá đã được xóa thành công!")
      window.setTimeout(() => {
        location.reload()
      }, 1500)
    }
  } catch (err) {
    console.error("Error deleting review:", err)
    showAlert("error", err.response ? err.response.data.message : "Đã xảy ra lỗi khi xóa đánh giá")
  }
}

// Xử lý chỉnh sửa đánh giá
export const handleEditReview = () => {
  const editButtons = document.querySelectorAll(".btn-edit-my-review")
  const modal = document.getElementById("review-modal")
  const closeBtn = document.querySelector(".modal__close")
  const form = document.querySelector(".form-edit-review")
  const reviewIdInput = document.getElementById("review-id")
  const reviewTourIdInput = document.getElementById("review-tour-id")
  const reviewTextInput = document.getElementById("review-text")
  const ratingInputs = document.querySelectorAll('input[name="rating"]')

  // Mở modal khi nhấn nút chỉnh sửa
  editButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const reviewId = e.target.dataset.reviewId
      const tourId = e.target.dataset.tourId
      const reviewText = e.target.dataset.reviewText
      const reviewRating = e.target.dataset.reviewRating
      console.log("Edit review button clicked for review ID:", reviewId)

      // Điền thông tin vào form
      reviewIdInput.value = reviewId
      reviewTourIdInput.value = tourId
      reviewTextInput.value = reviewText

      // Chọn rating
      ratingInputs.forEach((input) => {
        if (Number.parseInt(input.value, 10) === Number.parseInt(reviewRating, 10)) {
          input.checked = true
        }
      })

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
        const reviewId = reviewIdInput.value
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

        await updateReview(reviewId, reviewData)
        modal.classList.add("hidden")
      } catch (err) {
        console.error("Error in form submission:", err)
        showAlert("error", err.message || "Đã xảy ra lỗi khi cập nhật đánh giá")
      } finally {
        saveButton.textContent = originalButtonText
        saveButton.disabled = false
      }
    })
  }
}

// Xử lý xóa đánh giá
export const handleDeleteReview = () => {
  const deleteButtons = document.querySelectorAll(".btn-delete-my-review")

  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const reviewId = e.target.dataset.reviewId
      console.log("Delete button clicked for review ID:", reviewId)

      if (confirm("Bạn có chắc chắn muốn xóa đánh giá này? Hành động này không thể hoàn tác.")) {
        await deleteReview(reviewId)
      }
    })
  })
}

// Xử lý lọc đánh giá
export const initReviewsFilter = () => {
  const searchInput = document.querySelector(".reviews-search")
  const ratingFilter = document.querySelector(".reviews-rating")
  const reviewItems = document.querySelectorAll(".review-item")

  if (!searchInput || !ratingFilter || reviewItems.length === 0) return

  const filterReviews = () => {
    const searchTerm = searchInput.value.toLowerCase()
    const ratingValue = ratingFilter.value

    reviewItems.forEach((item) => {
      const tourName = item.querySelector(".review-item__tour").textContent.toLowerCase()
      const reviewText = item.querySelector(".review-item__content").textContent.toLowerCase()
      const rating = item.querySelectorAll(".review-item__star--active").length

      let shouldShow = tourName.includes(searchTerm) || reviewText.includes(searchTerm)

      if (shouldShow && ratingValue) {
        shouldShow = rating === Number.parseInt(ratingValue, 10)
      }

      item.style.display = shouldShow ? "block" : "none"
    })

    // Hiển thị thông báo nếu không có kết quả
    const reviewsList = document.querySelector(".reviews-list")
    const emptyMessage = document.querySelector(".reviews-empty")

    if (!emptyMessage && Array.from(reviewItems).every((item) => item.style.display === "none")) {
      const emptyEl = document.createElement("div")
      emptyEl.className = "reviews-empty empty-tours reviews-empty--filter"
      emptyEl.innerHTML = "<p class='empty-tours-text'>Không tìm thấy đánh giá nào phù hợp.</p>"
      reviewsList.appendChild(emptyEl)
    } else if (emptyMessage && emptyMessage.classList.contains("reviews-empty--filter")) {
      if (Array.from(reviewItems).some((item) => item.style.display === "block")) {
        emptyMessage.remove()
      }
    }
  }

  searchInput.addEventListener("input", filterReviews)
  ratingFilter.addEventListener("change", filterReviews)
}

// Khởi tạo trang đánh giá của tôi
export const initMyReviews = () => {
  handleEditReview()
  handleDeleteReview()
  initReviewsFilter()
}
