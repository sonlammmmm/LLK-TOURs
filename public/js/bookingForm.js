/* eslint-disable */
document.addEventListener("DOMContentLoaded", function () {
  // ==== ELEMENTS ====
  const dateButtons = document.querySelectorAll(".booking-date-btn");
  const selectedDateInput = document.getElementById("selectedDate");
  const participantsInput = document.getElementById("participants-input");
  const participantsNumber = document.getElementById("participants-number");
  const participantsDisplay = document.getElementById("participants-display");
  const decreaseBtn = document.querySelector(".decrease-btn");
  const increaseBtn = document.querySelector(".increase-btn");
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

      console.log("✅ Đã chọn ngày:", selectedDate, "- Slots:", maxSlotsForSelectedDate);

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
    bookTourBtn.addEventListener("click", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      console.log("🔍 Checking validation - selectedDate:", selectedDate);

      // Nếu chưa chọn ngày thì nút đã bị disable, không cần kiểm tra
      // Chỉ log để debug
      if (!selectedDate) {
        console.error("❌ Error: No date selected but button was clicked");
        return;
      }

      console.log("✅ Validation passed - proceeding with booking");

      const tourId = this.dataset.tourId;

      // Vô hiệu hóa nút để tránh click nhiều lần
      bookTourBtn.disabled = true;
      const originalText = bookTourBtn.textContent;
      bookTourBtn.textContent = "Đang xử lý...";

      try {
        // Gọi hàm đặt tour (Stripe, VNPay, etc.)
        if (window.bookTour) {
          console.log("📞 Calling bookTour with:", { tourId, selectedDate, currentParticipants });
          await window.bookTour(tourId, selectedDate, currentParticipants);
        } else {
          console.error("❌ Không tìm thấy hàm xử lý thanh toán");
          // Khôi phục nút
          bookTourBtn.disabled = false;
          bookTourBtn.textContent = originalText;
        }
      } catch (error) {
        console.error("❌ Lỗi khi xử lý thanh toán:", error);
        // Khôi phục nút nếu có lỗi
        bookTourBtn.disabled = false;
        bookTourBtn.textContent = originalText;
      }
    });
  }

  // ==== KHỞI TẠO ====
  updateTotalPrice();
  updateButtonStates();
  updateBookButtonState();

  console.log("📋 Booking form initialized");
  console.log("   - Tour price:", tourPrice);
  console.log("   - Max size:", maxSize);
  console.log("   - Available dates:", dateButtons.length);

  // Nếu chỉ có 1 ngày, tự động chọn
  if (dateButtons.length === 1) {
    console.log("ℹ️ Chỉ có 1 ngày, tự động chọn");
    dateButtons[0].click();
  }
});