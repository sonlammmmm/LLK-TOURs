/* eslint-disable */
export const initViewToggle = () => {
  const btnToggleView = document.querySelector(".btn-toggle-view");
  const tableContainer = document.querySelector(".table-container");
  const gridContainer = document.querySelector(
    ".tour-management__list, .user-management__list, .booking-management__list"
  );

  if (!btnToggleView || !tableContainer || !gridContainer) return;

  // Khởi tạo chế độ xem
  let isTableView = false;

  // Xử lý chuyển đổi chế độ xem
  btnToggleView.addEventListener("click", () => {
    isTableView = !isTableView;

    if (isTableView) {
      tableContainer.classList.remove("hidden");
      gridContainer.classList.add("hidden");
      btnToggleView.textContent = "Chế độ xem lưới";
    } else {
      tableContainer.classList.add("hidden");
      gridContainer.classList.remove("hidden");
      btnToggleView.textContent = "Chế độ xem bảng";
    }
    console.debug("Chuyển đổi chế độ xem:", isTableView ? "Table View" : "Grid View");
    // Khi chuyển đổi, cũng chạy lại hàm filterItems để cập nhật giao diện
    filterItems();
  });

  // Xử lý tìm kiếm và lọc
  const searchInput = document.querySelector(".search-input");
  const filterSelects = document.querySelectorAll(
    ".filter-role, .filter-status, .filter-duration, .filter-price"
  );

  if (searchInput) {
    searchInput.addEventListener("input", filterItems);
  }

  filterSelects.forEach((select) => {
    select.addEventListener("change", filterItems);
  });

  function filterItems() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";
    const roleFilter = document.querySelector(".filter-role") ? document.querySelector(".filter-role").value : "";
    const statusFilter = document.querySelector(".filter-status") ? document.querySelector(".filter-status").value : "";
    const durationFilter = document.querySelector(".filter-duration") ? document.querySelector(".filter-duration").value : "";
    const priceFilter = document.querySelector(".filter-price") ? document.querySelector(".filter-price").value : "";

    console.log("Filtering with:", {
      searchTerm,
      roleFilter,
      statusFilter,
      durationFilter,
      priceFilter,
    });

    // Lọc trong chế độ xem lưới
    const gridItems = document.querySelectorAll(
      ".tour-management__item, .user-management__item, .booking-management__item"
    );
    let visibleCount = 0;

    gridItems.forEach((item, index) => {
      const name =
        item
          .querySelector(".tour-management__name, .user-management__name, .booking-management__tour")
          ?.textContent.toLowerCase() || "";
      let shouldShow = name.includes(searchTerm);
      console.debug(`Grid [${index}] - Tên: ${name}, so sánh với "${searchTerm}":`, shouldShow);

      // Lọc theo vai trò (cho user)
      if (shouldShow && roleFilter && item.querySelector(".user-management__role")) {
        const role = item.querySelector(".user-management__role").textContent.toLowerCase();
        shouldShow = role.includes(roleFilter.toLowerCase());
        console.debug(`Grid [${index}] - Vai trò: ${role}, so sánh với "${roleFilter}":`, shouldShow);
      }

      // Lọc theo trạng thái (cho user)
      if (shouldShow && statusFilter && item.classList.contains("user-management__item")) {
        const isActive = item.querySelector(".user-management__status--active") !== null;
        const isInactive = item.querySelector(".user-management__status--inactive") !== null;

        if (statusFilter === "active") {
          shouldShow = isActive;
        } else if (statusFilter === "inactive") {
          shouldShow = isInactive;
        }
        console.debug(`Grid [${index}] - Trạng thái (user):`, shouldShow);
      }

      // Lọc theo trạng thái thanh toán (cho booking)
      if (shouldShow && statusFilter && item.classList.contains("booking-management__item")) {
        const isPaid = item.querySelector(".booking-management__status--paid") !== null;
        const isUnpaid = item.querySelector(".booking-management__status--unpaid") !== null;

        if (statusFilter === "paid") {
          shouldShow = isPaid;
        } else if (statusFilter === "unpaid") {
          shouldShow = isUnpaid;
        }
        console.debug(`Grid [${index}] - Trạng thái thanh toán (booking):`, shouldShow);
      }

      // Lọc theo thời gian (cho tour)
      if (shouldShow && durationFilter && item.querySelector(".tour-management__duration")) {
        const durationText = item.querySelector(".tour-management__duration").textContent;
        const duration = Number.parseInt(durationText);
        if (durationFilter === "1-3") {
          shouldShow = duration >= 1 && duration <= 3;
        } else if (durationFilter === "4-7") {
          shouldShow = duration >= 4 && duration <= 7;
        } else if (durationFilter === "8+") {
          shouldShow = duration >= 8;
        }
        console.debug(`Grid [${index}] - Thời gian: ${duration} ngày, so sánh với "${durationFilter}":`, shouldShow);
      }

      // Lọc theo giá (cho tour)
      if (shouldShow && priceFilter && item.querySelector(".tour-management__price")) {
        const priceText = item.querySelector(".tour-management__price").textContent;
        const price = Number.parseInt(priceText.replace(/[^\d]/g, ""));
        console.debug(`Grid [${index}] - Giá ban đầu: ${priceText} => số: ${price}`);
        if (priceFilter === "0-3000000") {
          shouldShow = price >= 0 && price <= 3000000;
          console.debug(`Grid [${index}] - Kiểm tra giá 0-3000000:`, shouldShow);
        } else if (priceFilter === "3000000-6000000") {
          shouldShow = price >= 3000000 && price <= 6000000;
          console.debug(`Grid [${index}] - Kiểm tra giá 3000000-6000000:`, shouldShow);
        } else if (priceFilter === "6000000+") {
          shouldShow = price >= 6000000;
          console.debug(`Grid [${index}] - Kiểm tra giá 6000000+:`, shouldShow);
        }
      }

      item.style.display = shouldShow ? "" : "none";
      if (shouldShow) visibleCount++;
    });

    // Lọc trong chế độ xem bảng
    const tableRows = document.querySelectorAll(".table-view tbody tr");
    let tableVisibleCount = 0;

    tableRows.forEach((row, index) => {
      if (row.cells.length <= 1) return; // Bỏ qua hàng "Không có dữ liệu"

      const name = row.cells[1]?.textContent.toLowerCase() || "";
      let shouldShow = name.includes(searchTerm);
      console.debug(`Table [${index}] - Tên: ${name}, so sánh với "${searchTerm}":`, shouldShow);

      // Lọc theo vai trò (cho user)
      if (shouldShow && roleFilter && row.cells[3]) {
        const role = row.cells[3].textContent.toLowerCase();
        shouldShow = role.includes(roleFilter.toLowerCase());
        console.debug(`Table [${index}] - Vai trò: ${role}, so sánh với "${roleFilter}":`, shouldShow);
      }

      // Lọc theo trạng thái (cho user)
      if (shouldShow && statusFilter && row.cells[4] && document.querySelector(".user-management__list")) {
        const status = row.cells[4]?.textContent.toLowerCase() || "";
        if (statusFilter === "active") {
          shouldShow = status.includes("hoạt động") && !status.includes("không hoạt động");
        } else if (statusFilter === "inactive") {
          shouldShow = status.includes("không hoạt động");
        }
        console.debug(`Table [${index}] - Trạng thái (user):`, shouldShow);
      }

      // Lọc theo trạng thái thanh toán (cho booking)
      if (shouldShow && statusFilter && row.cells[5] && document.querySelector(".booking-management__list")) {
        const status = row.cells[5]?.textContent.toLowerCase() || "";
        if (statusFilter === "paid") {
          shouldShow = status.includes("đã thanh toán");
        } else if (statusFilter === "unpaid") {
          shouldShow = status.includes("chưa thanh toán");
        }
        console.debug(`Table [${index}] - Trạng thái thanh toán (booking):`, shouldShow);
      }

      // Lọc theo thời gian (cho tour)
      if (shouldShow && durationFilter && row.cells[2] && document.querySelector(".tour-management__list")) {
        const durationText = row.cells[2].textContent;
        const duration = Number.parseInt(durationText);
        if (durationFilter === "1-3") {
          shouldShow = duration >= 1 && duration <= 3;
        } else if (durationFilter === "4-7") {
          shouldShow = duration >= 4 && duration <= 7;
        } else if (durationFilter === "8+") {
          shouldShow = duration >= 8;
        }
        console.debug(`Table [${index}] - Thời gian: ${duration} ngày, so sánh với "${durationFilter}":`, shouldShow);
      }

      // Lọc theo giá (cho tour)
      if (shouldShow && priceFilter && row.cells[4] && document.querySelector(".tour-management__list")) {
        const priceText = row.cells[4].textContent;
        const price = Number.parseInt(priceText.replace(/[^\d]/g, ""));
        console.debug(`Table [${index}] - Giá ban đầu: ${priceText} => số: ${price}`);
        if (priceFilter === "0-3000000") {
          shouldShow = price >= 0 && price <= 3000000;
          console.debug(`Table [${index}] - Kiểm tra giá 0-3000000:`, shouldShow);
        } else if (priceFilter === "3000000-6000000") {
          shouldShow = price >= 3000000 && price <= 6000000;
          console.debug(`Table [${index}] - Kiểm tra giá 3000000-6000000:`, shouldShow);
        } else if (priceFilter === "6000000+") {
          shouldShow = price >= 6000000;
          console.debug(`Table [${index}] - Kiểm tra giá 6000000+:`, shouldShow);
        }
      }

      row.style.display = shouldShow ? "" : "none";
      if (shouldShow) tableVisibleCount++;
    });

    // Hiển thị thông báo không có dữ liệu
    const noDataMessage = document.querySelector(".no-data-message");
    if (noDataMessage) {
      if ((isTableView && tableVisibleCount === 0) || (!isTableView && visibleCount === 0)) {
        noDataMessage.classList.remove("hidden");
        if (priceFilter) {
          noDataMessage.textContent = "Không có tour nào với mức giá bạn chọn.";
        } else if (durationFilter) {
          noDataMessage.textContent = "Không có tour nào với thời gian bạn chọn.";
        } else if (roleFilter) {
          noDataMessage.textContent = "Không có người dùng nào với vai trò bạn chọn.";
        } else if (statusFilter && document.querySelector(".user-management__list")) {
          noDataMessage.textContent = "Không có người dùng nào với trạng thái bạn chọn.";
        } else if (statusFilter && document.querySelector(".booking-management__list")) {
          noDataMessage.textContent = "Không có đặt tour nào với trạng thái bạn chọn.";
        } else if (searchTerm) {
          noDataMessage.textContent = `Không tìm thấy kết quả cho "${searchTerm}".`;
        } else {
          noDataMessage.textContent = "Không có dữ liệu nào.";
        }
      } else {
        noDataMessage.classList.add("hidden");
      }
    }

    // Cập nhật số lượng hiển thị
    const countDisplay = document.querySelector(".count-display");
    if (countDisplay) {
      const totalCount = gridItems.length;
      const visibleCountToShow = isTableView ? tableVisibleCount : visibleCount;
      countDisplay.innerHTML = `Đang hiển thị <strong>${visibleCountToShow}</strong> trên tổng số <strong>${totalCount}</strong>`;
      console.debug(`Hiển thị ${visibleCountToShow} trên tổng số ${totalCount}`);
    }
  }
};
