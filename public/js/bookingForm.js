/* eslint-disable */
document.addEventListener("DOMContentLoaded", function () {
  // ==== ELEMENTS ====
  const dateButtons = document.querySelectorAll(".date-button");
  const selectedDateInput = document.getElementById("selectedDate");
  const participantsInput = document.getElementById("participants-input");
  const participantsNumber = document.getElementById("participants-number");
  const participantsDisplay = document.getElementById("participants-display");
  const decreaseBtn = document.querySelector(".participants-btn-decrease");
  const increaseBtn = document.querySelector(".participants-btn-increase");
  const totalPriceEl = document.getElementById("total-price");
  const bookTourBtn = document.getElementById("book-tour");

  // Kiểm tra các phần tử chính
  if (!bookTourBtn || !participantsInput) return;

  // ==== CONSTANTS ====
  const tourPrice = parseInt(bookTourBtn.dataset.price || "0", 10);
  const maxSize = parseInt(bookTourBtn.dataset.maxSize || "10", 10);

  // ==== STATE ====
  let currentParticipants = 1;
  let selectedDate = null;
  let maxSlotsForSelectedDate = maxSize;

  // ==== FUNCTIONS ====

  // Cập nhật tổng tiền
  function updateTotalPrice() {
    const totalPrice = tourPrice * currentParticipants;
    if (totalPriceEl) {
      totalPriceEl.textContent = `${totalPrice.toLocaleString("vi-VN")} ₫`;
    }
    if (participantsDisplay) {
      participantsDisplay.textContent = currentParticipants;
    }
  }

  // Cập nhật trạng thái nút tăng/giảm
  function updateButtonStates() {
    if (decreaseBtn) {
      decreaseBtn.disabled = currentParticipants <= 1;
    }
    if (increaseBtn) {
      const effectiveMax = Math.min(maxSize, maxSlotsForSelectedDate);
      increaseBtn.disabled = currentParticipants >= effectiveMax;
    }
  }

  // Cập nhật trạng thái nút thanh toán
  function updateBookButtonState() {
    if (bookTourBtn) {
      bookTourBtn.disabled = !selectedDate;
    }
  }

  // ==== CHỌN NGÀY ====
  dateButtons.forEach((button) => {
    button.addEventListener("click", function () {
      // Bỏ chọn ngày cũ
      dateButtons.forEach((btn) => btn.classList.remove("selected"));

      // Chọn ngày mới
      this.classList.add("selected");
      selectedDate = this.dataset.date;
      maxSlotsForSelectedDate = parseInt(this.dataset.slots || maxSize, 10);

      // Cập nhật hidden input
      if (selectedDateInput) {
        selectedDateInput.value = selectedDate;
      }

      // Điều chỉnh số người nếu vượt quá số chỗ
      if (currentParticipants > maxSlotsForSelectedDate) {
        currentParticipants = maxSlotsForSelectedDate;
        participantsInput.value = currentParticipants;
        if (participantsNumber) {
          participantsNumber.textContent = currentParticipants;
        }
        updateTotalPrice();
      }

      // Cập nhật trạng thái các nút
      updateButtonStates();
      updateBookButtonState();
    });
  });

  // ==== TĂNG/GIẢM SỐ NGƯỜI ====
  if (decreaseBtn) {
    decreaseBtn.addEventListener("click", function (e) {
      e.preventDefault();
      if (currentParticipants > 1) {
        currentParticipants--;
        participantsInput.value = currentParticipants;
        if (participantsNumber) {
          participantsNumber.textContent = currentParticipants;
        }
        updateTotalPrice();
        updateButtonStates();
      }
    });
  }

  if (increaseBtn) {
    increaseBtn.addEventListener("click", function (e) {
      e.preventDefault();
      const effectiveMax = Math.min(maxSize, maxSlotsForSelectedDate);
      
      if (currentParticipants < effectiveMax) {
        currentParticipants++;
        participantsInput.value = currentParticipants;
        if (participantsNumber) {
          participantsNumber.textContent = currentParticipants;
        }
        updateTotalPrice();
        updateButtonStates();
      } else {
        // Hiển thị thông báo giới hạn
        const limitMessage = selectedDate
          ? `Ngày này chỉ còn ${maxSlotsForSelectedDate} chỗ trống`
          : `Số lượng tối đa là ${maxSize} người`;
        alert(limitMessage);
      }
    });
  }

  // ==== XỬ LÝ THANH TOÁN ====
  if (bookTourBtn) {
    bookTourBtn.addEventListener("click", function (e) {
      e.preventDefault();

      // Kiểm tra đã chọn ngày chưa
      if (!selectedDate) {
        alert("Vui lòng chọn ngày khởi hành!");
        // Scroll đến phần chọn ngày
        const dateSection = document.querySelector(".date-buttons-grid");
        if (dateSection) {
          dateSection.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }

      const tourId = this.dataset.tourId;

      // Gọi hàm đặt tour (Stripe, VNPay, etc.)
      if (window.bookTour) {
        window.bookTour(tourId, selectedDate, currentParticipants);
      } else {
        console.error("Không tìm thấy hàm xử lý thanh toán");
        alert("Không tìm thấy hàm xử lý thanh toán. Vui lòng thử lại sau!");
      }
    });
  }

  // ==== KHỞI TẠO ====
  updateTotalPrice();
  updateButtonStates();
  updateBookButtonState();

  // Nếu chỉ có 1 ngày, tự động chọn
  if (dateButtons.length === 1) {
    dateButtons[0].click();
  }
});