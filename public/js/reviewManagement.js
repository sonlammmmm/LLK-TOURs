/* eslint-disable */
import axios from "axios"
import { showAlert } from "./alerts"

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

// Lấy thông tin đánh giá
export const getReview = async (reviewId) => {
  try {
    console.log("Getting review with ID:", reviewId)
    const url = `/api/v1/reviews/${reviewId}`

    const res = await axios({
      method: "GET",
      url,
    })

    if (res.data.status === "success") {
      return res.data.data.data
    }
  } catch (err) {
    console.error("Error getting review:", err)
    showAlert("error", err.response ? err.response.data.message : "Đã xảy ra lỗi khi lấy thông tin đánh giá")
    return null
  }
}

// Xử lý xóa đánh giá
export const handleDeleteReview = () => {
  const deleteButtons = document.querySelectorAll(".btn-delete-review")

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

// Xử lý chỉnh sửa đánh giá
export const handleEditReview = () => {
  const editButtons = document.querySelectorAll(".btn-edit-review")
  const modal = document.getElementById("edit-review-modal")
  const closeBtn = document.querySelector(".modal__close")
  const form = document.querySelector(".form-edit-review")
  const reviewIdInput = document.getElementById("review-id")
  const reviewTextInput = document.getElementById("review-text")
  const reviewRatingInput = document.getElementById("review-rating")

  // Mở modal khi nhấn nút sửa
  editButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const reviewId = e.target.dataset.reviewId
      console.log("Edit button clicked for review ID:", reviewId)

      // Lấy thông tin đánh giá
      const review = await getReview(reviewId)
      if (review) {
        // Điền thông tin vào form
        reviewIdInput.value = reviewId
        reviewTextInput.value = review.review
        reviewRatingInput.value = review.rating

        // Hiển thị modal
        modal.classList.remove("hidden")
      }
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
      saveButton.textContent = "Đang lưu..."
      saveButton.disabled = true

      try {
        const reviewId = reviewIdInput.value
        const reviewData = {
          review: reviewTextInput.value,
          rating: reviewRatingInput.value,
        }

        await updateReview(reviewId, reviewData)
        modal.classList.add("hidden")
      } catch (err) {
        console.error("Error in form submission:", err)
        showAlert("error", err.message || "Đã xảy ra lỗi khi lưu thông tin đánh giá")
      } finally {
        saveButton.textContent = originalButtonText
        saveButton.disabled = false
      }
    })
  }
}

// Xử lý tìm kiếm và lọc đánh giá
export const initReviewFilter = () => {
  const searchInput = document.querySelector(".search-input")
  const ratingFilter = document.querySelector(".filter-rating")
  const tableContainer = document.querySelector(".table-container")
  const isTableView = tableContainer && tableContainer.classList.contains("hidden") === false

  if (searchInput) {
    searchInput.addEventListener("input", filterReviews)
  }

  if (ratingFilter) {
    ratingFilter.addEventListener("change", filterReviews)
  }

  function filterReviews() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : ""
    const rating = ratingFilter ? ratingFilter.value : ""

    // Lọc trong chế độ xem lưới
    const gridItems = document.querySelectorAll(".review-management__item")
    let visibleCount = 0

    gridItems.forEach((item) => {
      const userName = item.querySelector(".review-management__user-name").textContent.toLowerCase()
      const tourName = item.querySelector(".review-management__tour").textContent.toLowerCase()
      const reviewText = item.querySelector(".review-management__text").textContent.toLowerCase()
      const reviewRating = item.querySelectorAll(".rating-star.rating-star--active").length

      let shouldShow = userName.includes(searchTerm) || tourName.includes(searchTerm) || reviewText.includes(searchTerm)

      if (shouldShow && rating) {
        shouldShow = reviewRating === Number.parseInt(rating, 10)
      }

      item.style.display = shouldShow ? "" : "none"
      if (shouldShow) visibleCount++
    })

    // Lọc trong chế độ xem bảng
    const tableRows = document.querySelectorAll(".table-view tbody tr")
    let tableVisibleCount = 0

    tableRows.forEach((row) => {
      if (row.cells.length <= 1) return // Bỏ qua hàng "Không có dữ liệu"

      const userName = row.cells[0].textContent.toLowerCase()
      const tourName = row.cells[1].textContent.toLowerCase()
      const reviewText = row.cells[2].textContent.toLowerCase()
      const reviewRating = row.cells[3].querySelectorAll(".rating-star.rating-star--active").length

      let shouldShow = userName.includes(searchTerm) || tourName.includes(searchTerm) || reviewText.includes(searchTerm)

      if (shouldShow && rating) {
        shouldShow = reviewRating === Number.parseInt(rating, 10)
      }

      row.style.display = shouldShow ? "" : "none"
      if (shouldShow) tableVisibleCount++
    })

    // Hiển thị thông báo không có dữ liệu
    const noDataMessage = document.querySelector(".no-data-message")
    if (noDataMessage) {
      if ((isTableView && tableVisibleCount === 0) || (!isTableView && visibleCount === 0)) {
        noDataMessage.classList.remove("hidden")
        if (rating) {
          noDataMessage.textContent = `Không có đánh giá nào với ${rating} sao.`
        } else if (searchTerm) {
          noDataMessage.textContent = `Không tìm thấy kết quả cho "${searchTerm}".`
        } else {
          noDataMessage.textContent = "Không có đánh giá nào."
        }
      } else {
        noDataMessage.classList.add("hidden")
      }
    }

    // Cập nhật số lượng hiển thị
    const countDisplay = document.querySelector(".count-display")
    if (countDisplay) {
      const totalCount = gridItems.length
      const visibleCountToShow = isTableView ? tableVisibleCount : visibleCount
      countDisplay.innerHTML = `Đang hiển thị <strong>${visibleCountToShow}</strong> trên tổng số <strong>${totalCount}</strong>`
    }
  }
}
