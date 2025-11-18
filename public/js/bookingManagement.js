/* eslint-disable */
import axios from "./vendor/axios.js"
import { showAlert } from "./alerts.js"

// Xóa booking
export const deleteBooking = async (bookingId) => {
  try {
    console.log("Deleting booking with ID:", bookingId)
    const url = `/api/v1/bookings/${bookingId}`

    const res = await axios({
      method: "DELETE",
      url,
    })

    if (res.status === 204) {
      showAlert("success", "Đặt tour đã được xóa thành công!")
      window.setTimeout(() => {
        location.assign("/admin/bookings")
      }, 1500)
    }
  } catch (err) {
    console.error("Error deleting booking:", err)
    showAlert("error", err.response ? err.response.data.message : "Đã xảy ra lỗi khi xóa đặt tour")
  }
}

// Cập nhật trạng thái thanh toán booking
export const updateBookingPaymentStatus = async (bookingId, isPaid) => {
  try {
    console.log(`Updating booking payment status to ${isPaid ? "paid" : "unpaid"} for ID:`, bookingId)
    const url = `/api/v1/bookings/${bookingId}`

    const res = await axios({
      method: "PATCH",
      url,
      data: { paid: isPaid },
    })

    if (res.data.status === "success") {
      showAlert("success", `Đặt tour đã được đánh dấu là ${isPaid ? "đã thanh toán" : "chưa thanh toán"}!`)
      window.setTimeout(() => {
        location.reload()
      }, 1500)
    }
  } catch (err) {
    console.error("Error updating booking payment status:", err)
    showAlert("error", err.response ? err.response.data.message : "Đã xảy ra lỗi khi cập nhật trạng thái đặt tour")
  }
}

// Xử lý xóa booking
export const handleDeleteBooking = () => {
  const deleteButtons = document.querySelectorAll(".btn-delete-booking")

  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const bookingId = e.target.dataset.bookingId
      console.log("Delete button clicked for booking ID:", bookingId)

      if (confirm("Bạn có chắc chắn muốn xóa đặt tour này? Hành động này không thể hoàn tác.")) {
        await deleteBooking(bookingId)
      }
    })
  })
}

// Xử lý cập nhật trạng thái thanh toán booking
export const handleUpdateBookingPaymentStatus = () => {
  const markPaidButton = document.querySelector(".btn-mark-paid")
  const markUnpaidButton = document.querySelector(".btn-mark-unpaid")

  if (markPaidButton) {
    markPaidButton.addEventListener("click", async (e) => {
      const bookingId = e.target.dataset.bookingId
      console.log("Mark as paid button clicked for booking ID:", bookingId)

      if (confirm("Bạn có chắc chắn muốn đánh dấu đặt tour này là đã thanh toán?")) {
        await updateBookingPaymentStatus(bookingId, true)
      }
    })
  }

  if (markUnpaidButton) {
    markUnpaidButton.addEventListener("click", async (e) => {
      const bookingId = e.target.dataset.bookingId
      console.log("Mark as unpaid button clicked for booking ID:", bookingId)

      if (confirm("Bạn có chắc chắn muốn đánh dấu đặt tour này là chưa thanh toán?")) {
        await updateBookingPaymentStatus(bookingId, false)
      }
    })
  }
}

// Thêm hàm xử lý nút chuyển trạng thái thanh toán
export const handleTogglePaymentStatus = () => {
  const toggleButtons = document.querySelectorAll(".btn-toggle-payment")

  toggleButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const bookingId = e.target.dataset.bookingId
      const currentPaid = e.target.dataset.paid === "true"
      console.log(`Toggle payment status button clicked for booking ID: ${bookingId}, current status: ${currentPaid}`)

      if (confirm(`Bạn có chắc chắn muốn đánh dấu đặt tour này là ${currentPaid ? "chưa" : "đã"} thanh toán?`)) {
        await updateBookingPaymentStatus(bookingId, !currentPaid)
      }
    })
  })
}

// Xử lý tìm kiếm và lọc booking
export const initBookingFilter = () => {
  const searchInput = document.querySelector(".search-input")
  const statusFilter = document.querySelector(".filter-status")
  const tableContainer = document.querySelector(".table-container")
  const isTableView = tableContainer && tableContainer.classList.contains("hidden") === false

  if (searchInput) {
    searchInput.addEventListener("input", filterBookings)
  }

  if (statusFilter) {
    statusFilter.addEventListener("change", filterBookings)
  }

  function filterBookings() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : ""
    const status = statusFilter ? statusFilter.value : ""

    // Lọc trong chế độ xem lưới
    const gridItems = document.querySelectorAll(".booking-management__item")
    let visibleCount = 0

    gridItems.forEach((item) => {
      const tourName = item.querySelector(".booking-management__tour").textContent.toLowerCase()
      const userName = item.querySelector(".booking-management__user-name").textContent.toLowerCase()
      const isPaid = item.querySelector(".booking-management__status--paid") !== null

      let shouldShow = tourName.includes(searchTerm) || userName.includes(searchTerm)

      if (shouldShow && status) {
        shouldShow = (status === "paid" && isPaid) || (status === "unpaid" && !isPaid)
      }

      item.style.display = shouldShow ? "" : "none"
      if (shouldShow) visibleCount++
    })

    // Lọc trong chế độ xem bảng
    const tableRows = document.querySelectorAll(".table-view tbody tr")
    let tableVisibleCount = 0

    tableRows.forEach((row) => {
      if (row.cells.length <= 1) return // Bỏ qua hàng "Không có dữ liệu"

      const tourName = row.cells[0].textContent.toLowerCase()
      const userName = row.cells[1].textContent.toLowerCase()
      const isPaid = row.cells[4].textContent.includes("Đã thanh toán")

      let shouldShow = tourName.includes(searchTerm) || userName.includes(searchTerm)

      if (shouldShow && status) {
        shouldShow = (status === "paid" && isPaid) || (status === "unpaid" && !isPaid)
      }

      row.style.display = shouldShow ? "" : "none"
      if (shouldShow) tableVisibleCount++
    })

    // Hiển thị thông báo không có dữ liệu
    const noDataMessage = document.querySelector(".no-data-message")
    if (noDataMessage) {
      if ((isTableView && tableVisibleCount === 0) || (!isTableView && visibleCount === 0)) {
        noDataMessage.classList.remove("hidden")
        if (status) {
          noDataMessage.textContent = `Không có đặt tour nào với trạng thái "${
            status === "paid" ? "Đã thanh toán" : "Chưa thanh toán"
          }".`
        } else if (searchTerm) {
          noDataMessage.textContent = `Không tìm thấy kết quả cho "${searchTerm}".`
        } else {
          noDataMessage.textContent = "Không có đặt tour nào."
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
