/* eslint-disable */
import axios from "axios"
import { showAlert } from "./alerts"

// Sử dụng API createTour từ tourController
export const createTour = async (tourData) => {
  try {
    const url = "/api/v1/tours"

    const res = await axios({
      method: "POST",
      url,
      data: tourData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })

    if (res.data.status === "success") {
      showAlert("success", "Tour đã được tạo thành công!")
      window.setTimeout(() => {
        location.assign("/admin/tours")
      }, 1500)
    }
  } catch (err) {
    console.error("Error creating tour:", err)
    showAlert("error", err.response ? err.response.data.message : "Đã xảy ra lỗi khi tạo tour")
  }
}

// Sử dụng API updateTour từ tourController
export const updateTour = async (tourId, tourData) => {
  try {
    const url = `/api/v1/tours/${tourId}`

    const res = await axios({
      method: "PATCH",
      url,
      data: tourData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })

    if (res.data.status === "success") {
      showAlert("success", "Tour đã được cập nhật thành công!")
      window.setTimeout(() => {
        location.reload()
      }, 1500)
    }
  } catch (err) {
    console.error("Error updating tour:", err)
    showAlert("error", err.response ? err.response.data.message : "Đã xảy ra lỗi khi cập nhật tour")
  }
}

// Sử dụng API deleteTour từ tourController
export const deleteTour = async (tourId) => {
  try {
    const url = `/api/v1/tours/${tourId}`

    const res = await axios({
      method: "DELETE",
      url,
    })

    if (res.status === 204) {
      showAlert("success", "Tour đã được xóa thành công!")
      window.setTimeout(() => {
        location.reload()
      }, 1500)
    }
  } catch (err) {
    showAlert("error", err.response ? err.response.data.message : "Đã xảy ra lỗi khi xóa tour")
  }
}

// Hàm helper để xử lý tọa độ đúng định dạng
const parseCoordinates = (coordsStr) => {
  const coords = coordsStr.split(",").map((coord) => Number.parseFloat(coord.trim()))
  
  // Kiểm tra tính hợp lệ của tọa độ
  if (coords.length !== 2 || isNaN(coords[0]) || isNaN(coords[1])) {
    throw new Error("Tọa độ không hợp lệ. Vui lòng nhập theo định dạng: kinh độ, vĩ độ")
  }
  
  const [lng, lat] = coords
  
  // Kiểm tra phạm vi tọa độ hợp lệ
  if (lng < -180 || lng > 180) {
    throw new Error(`Kinh độ không hợp lệ: ${lng}. Kinh độ phải từ -180 đến 180`)
  }
  
  if (lat < -90 || lat > 90) {
    throw new Error(`Vĩ độ không hợp lệ: ${lat}. Vĩ độ phải từ -90 đến 90`)
  }
  
  if (lng > 90 && lng < 180 && lat > 8 && lat < 24) {
    console.warn("Cảnh báo: Tọa độ có vẻ bị đảo ngược. Đối với Việt Nam, kinh độ thường từ 102-110, vĩ độ từ 8-24")
  }
  
  return [lng, lat]
}

// Xử lý form tour
export const handleTourForm = () => {
  const form = document.querySelector(".form-tour")
  if (!form) return

  const tourId = document.getElementById("tour-id").value

  // Xử lý thêm địa điểm
  const locationsContainer = document.querySelector(".locations-container")
  const btnAddLocation = document.querySelector(".btn-add-location")

  if (btnAddLocation) {
    btnAddLocation.addEventListener("click", () => {
      const locationIndex = document.querySelectorAll(".location-item").length
      const locationHtml = `
        <div class="location-item" data-index="${locationIndex}">
          <button class="location-item__remove" type="button">×</button>
          <div class="form__group">
            <label class="form__label">Mô tả</label>
            <input class="location-description form__input" type="text" required>
          </div>
          <div class="form__group">
            <label class="form__label">Địa chỉ</label>
            <input class="location-address form__input" type="text" required>
          </div>
          <div class="form__group">
            <label class="form__label">Tọa độ (kinh độ, vĩ độ)</label>
            <input class="location-coordinates form__input" type="text" required placeholder="106.695249, 10.775400">
            <small class="form__help">Định dạng: kinh độ, vĩ độ (VD: 106.695, 10.775)</small>
          </div>
          <div class="form__group">
            <label class="form__label">Ngày thứ</label>
            <input class="location-day form__input" type="number" required min="1">
          </div>
        </div>
      `
      locationsContainer.insertAdjacentHTML("beforeend", locationHtml)
      addLocationRemoveListeners()
    })
  }

  // Xử lý thêm ngày khởi hành
  const startDatesContainer = document.querySelector(".start-dates-container")
  const btnAddStartDate = document.querySelector(".btn-add-start-date")

  if (btnAddStartDate) {
    btnAddStartDate.addEventListener("click", () => {
      const dateIndex = document.querySelectorAll(".start-date-item").length
      const dateHtml = `
        <div class="start-date-item" data-index="${dateIndex}">
          <button class="start-date-item__remove" type="button">×</button>
          <div class="form__group">
            <label class="form__label">Ngày khởi hành</label>
            <input class="start-date form__input" type="date" required>
          </div>
        </div>
      `
      startDatesContainer.insertAdjacentHTML("beforeend", dateHtml)
      addStartDateRemoveListeners()
    })
  }

  // Xử lý thêm hướng dẫn viên
  const guidesContainer = document.querySelector(".guides-container")
  const btnAddGuide = document.querySelector(".btn-add-guide")

  if (btnAddGuide) {
    btnAddGuide.addEventListener("click", () => {
      const guideIndex = document.querySelectorAll(".guide-item").length
      const guideSelectOptions = Array.from(document.querySelectorAll(".guide-select option"))
        .map((option) => `<option value="${option.value}">${option.textContent}</option>`)
        .join("")

      const guideHtml = `
        <div class="guide-item" data-index="${guideIndex}">
          <button class="guide-item__remove" type="button">×</button>
          <div class="form__group">
            <label class="form__label">Hướng dẫn viên</label>
            <select class="guide-select form__input" required>
              ${guideSelectOptions}
            </select>
          </div>
        </div>
      `
      guidesContainer.insertAdjacentHTML("beforeend", guideHtml)
      addGuideRemoveListeners()
    })
  }

  // Thêm event listener cho nút xóa địa điểm
  function addLocationRemoveListeners() {
    document.querySelectorAll(".location-item__remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.target.closest(".location-item").remove()
      })
    })
  }

  // Thêm event listener cho nút xóa ngày khởi hành
  function addStartDateRemoveListeners() {
    document.querySelectorAll(".start-date-item__remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.target.closest(".start-date-item").remove()
      })
    })
  }

  // Thêm event listener cho nút xóa hướng dẫn viên
  function addGuideRemoveListeners() {
    document.querySelectorAll(".guide-item__remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.target.closest(".guide-item").remove()
      })
    })
  }

  // Khởi tạo các event listener
  addLocationRemoveListeners()
  addStartDateRemoveListeners()
  addGuideRemoveListeners()

  // Xử lý submit form
  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    document.querySelector(".btn-save-tour").textContent = "Đang lưu..."
    document.querySelector(".btn-save-tour").disabled = true

    try {
      // Lấy dữ liệu từ form
      const formData = new FormData()

      // Thông tin cơ bản
      formData.append("name", document.getElementById("name").value)
      formData.append("duration", document.getElementById("duration").value)
      formData.append("maxGroupSize", document.getElementById("maxGroupSize").value)
      formData.append("price", document.getElementById("price").value)

      // Xử lý giảm giá - chỉ thêm nếu có giá trị
      const priceDiscount = document.getElementById("priceDiscount").value
      if (priceDiscount && priceDiscount.trim() !== "") {
        formData.append("priceDiscount", priceDiscount)
      }

      formData.append("summary", document.getElementById("summary").value)

      const description = document.getElementById("description").value
      if (description) formData.append("description", description)

      // Địa điểm bắt đầu - XỬ LÝ TỌA ĐỘ ĐÚNG
      const startLocationDesc = document.getElementById("startLocation").value
      const startLocationAddr = document.getElementById("startLocationAddress").value
      const startLocationCoordsStr = document.getElementById("startLocationCoordinates").value

      // Sử dụng hàm helper để parse tọa độ
      const startLocationCoords = parseCoordinates(startLocationCoordsStr)

      formData.append("startLocation[description]", startLocationDesc)
      formData.append("startLocation[address]", startLocationAddr)
      formData.append("startLocation[type]", "Point")
      formData.append("startLocation[coordinates][0]", startLocationCoords[0]) // longitude
      formData.append("startLocation[coordinates][1]", startLocationCoords[1]) // latitude

      // Xử lý địa điểm trong tour - XỬ LÝ TỌA ĐỘ ĐÚNG
      document.querySelectorAll(".location-item").forEach((item, index) => {
        const description = item.querySelector(".location-description").value
        const address = item.querySelector(".location-address").value
        const coordsStr = item.querySelector(".location-coordinates").value
        const day = Number.parseInt(item.querySelector(".location-day").value)

        // Sử dụng hàm helper để parse tọa độ
        const coords = parseCoordinates(coordsStr)

        formData.append(`locations[${index}][type]`, "Point")
        formData.append(`locations[${index}][coordinates][0]`, coords[0]) // longitude
        formData.append(`locations[${index}][coordinates][1]`, coords[1]) // latitude
        formData.append(`locations[${index}][address]`, address)
        formData.append(`locations[${index}][description]`, description)
        formData.append(`locations[${index}][day]`, day)
      })

      // Xử lý ngày khởi hành
      document.querySelectorAll(".start-date-item").forEach((item, index) => {
        const date = item.querySelector(".start-date").value
        if (date) {
          formData.append(`startDates[${index}]`, new Date(date).toISOString())
        }
      })

      // Xử lý hướng dẫn viên
      document.querySelectorAll(".guide-item").forEach((item, index) => {
        const guideId = item.querySelector(".guide-select").value
        if (guideId) {
          formData.append(`guides[${index}]`, guideId)
        }
      })

      // Xử lý ảnh
      const imageCoverInput = document.getElementById("imageCover")
      if (imageCoverInput.files.length > 0) {
        formData.append("imageCover", imageCoverInput.files[0])
      }

      const imagesInput = document.getElementById("images")
      if (imagesInput.files.length > 0) {
        for (let i = 0; i < imagesInput.files.length; i++) {
          formData.append("images", imagesInput.files[i])
        }
      }

      console.log("Form data prepared, sending request...")

      // Gửi dữ liệu
      if (tourId) {
        await updateTour(tourId, formData)
      } else {
        await createTour(formData)
      }
    } catch (err) {
      console.error("Error in form submission:", err)
      showAlert("error", err.message || "Đã xảy ra lỗi khi lưu tour")
    } finally {
      document.querySelector(".btn-save-tour").textContent = "Lưu"
      document.querySelector(".btn-save-tour").disabled = false
    }
  })
}

// Xử lý xóa tour
export const handleDeleteTour = () => {
  const deleteButtons = document.querySelectorAll(".btn-delete-tour")

  deleteButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const tourId = e.target.dataset.tourId

      if (confirm("Bạn có chắc chắn muốn xóa tour này? Hành động này không thể hoàn tác.")) {
        await deleteTour(tourId)
      }
    })
  })
}