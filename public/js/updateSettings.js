/* eslint-disable */
import axios from "axios"
import { showAlert } from "./alerts"

// type is either 'password' or 'data'
export const updateSettings = async (data, type) => {
  try {
    const url = type === "password" ? "/api/v1/users/updateMyPassword" : "/api/v1/users/updateMe"

    const res = await axios({
      method: "PATCH",
      url,
      data,
    })

    if (res.data.status === "success") {
      showAlert("success", `${type.toUpperCase()} sửa đổi thành công!`)
      window.setTimeout(() => {
        location.reload()
      }, 1500)
    }
  } catch (err) {
    showAlert("error", err.response.data.message)
  }
}

// Thêm hàm hiển thị tên file sau khi chọn
export const initFileInputs = () => {
  // Xử lý hiển thị tên file khi chọn ảnh đại diện
  const photoInput = document.getElementById("photo")
  if (photoInput) {
    photoInput.addEventListener("change", function () {
      const fileName = this.files[0]?.name || "Không có file nào được chọn"
      const fileLabel = this.nextElementSibling
      fileLabel.textContent = fileName
    })
  }

  // Xử lý hiển thị tên file khi chọn ảnh bìa tour
  const imageCoverInput = document.getElementById("imageCover")
  if (imageCoverInput) {
    imageCoverInput.addEventListener("change", function () {
      const fileName = this.files[0]?.name || "Không có file nào được chọn"
      const fileLabel = this.nextElementSibling
      fileLabel.textContent = fileName
    })
  }

  // Xử lý hiển thị tên file khi chọn ảnh tour
  const imagesInput = document.getElementById("images")
  if (imagesInput) {
    imagesInput.addEventListener("change", function () {
      const fileCount = this.files.length
      const fileLabel = this.nextElementSibling
      if (fileCount > 0) {
        fileLabel.textContent = `Đã chọn ${fileCount} ảnh`
      } else {
        fileLabel.textContent = "Chọn ảnh tour"
      }
    })
  }

  // Xử lý hiển thị tên file khi chọn tệp đính kèm
  const attachmentFileInput = document.getElementById("attachment-file")
  if (attachmentFileInput) {
    attachmentFileInput.addEventListener("change", function () {
      const fileName = this.files[0]?.name || "Không có file nào được chọn"
      const fileLabel = this.nextElementSibling
      fileLabel.textContent = fileName
    })
  }
}
