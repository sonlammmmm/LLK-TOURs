/* eslint-disable */
import axios from "./vendor/axios.js"
import { showAlert } from "./alerts.js"

// Sửa lại hàm updateUser để xử lý đúng việc upload ảnh
export const updateUser = async (userId, userData) => {
  try {
    console.log("Đang cập nhật người dùng có ID:", userId)

    // Sử dụng API updateUser trực tiếp
    const url = `/api/v1/users/${userId}`
    const method = "PATCH"

    // Ghi log dữ liệu FormData để gỡ lỗi
    if (userData instanceof FormData) {
      for (const pair of userData.entries()) {
        console.log(pair[0] + ": " + pair[1])
      }
    }

    const res = await axios({
      method,
      url,
      data: userData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    })

    if (res.data.status === "success") {
      showAlert("success", "Thông tin người dùng đã được cập nhật thành công!")
      window.setTimeout(() => {
        location.reload() // Tải lại trang để hiển thị thông tin mới
      }, 1500)
    }
  } catch (err) {
    console.error("Lỗi khi cập nhật người dùng:", err)
    if (err.response && err.response.data.message.includes("duplicate key error")) {
      showAlert("error", "Email này đã được sử dụng bởi người dùng khác. Vui lòng chọn email khác.")
    } else {
      showAlert("error", err.response ? err.response.data.message : "Đã xảy ra lỗi khi cập nhật người dùng")
    }
  }
}

// Vô hiệu hóa người dùng (đặt active = false)
export const deactivateUser = async (userId) => {
  try {
    console.log("Đang vô hiệu hóa người dùng có ID:", userId)
    const url = `/api/v1/users/${userId}`

    const res = await axios({
      method: "PATCH",
      url,
      data: { active: false },
    })

    if (res.data.status === "success") {
      showAlert("success", "Người dùng đã bị vô hiệu hóa thành công!")
      window.setTimeout(() => {
        location.reload()
      }, 1500)
    }
  } catch (err) {
    console.error("Lỗi khi vô hiệu hóa người dùng:", err)
    showAlert("error", err.response ? err.response.data.message : "Đã xảy ra lỗi khi vô hiệu hóa người dùng")
  }
}

// Kích hoạt người dùng (đặt active = true)
export const activateUser = async (userId) => {
  try {
    console.log("Đang kích hoạt người dùng có ID:", userId)
    const url = `/api/v1/users/activate/${userId}`;

    const res = await axios({
      method: "PATCH",
      url,
      data: { active: true },
    })

    if (res.data.status === "success") {
      showAlert("success", "Người dùng đã được kích hoạt thành công!")
      window.setTimeout(() => {
        location.reload()
      }, 1500)
    }
  } catch (err) {
    console.error("Lỗi khi kích hoạt người dùng:", err)
    showAlert("error", err.response ? err.response.data.message : "Đã xảy ra lỗi khi kích hoạt người dùng")
  }
}

// Xử lý form người dùng
export const handleUserForm = () => {
  const form = document.querySelector(".form-user")
  if (!form) return

  const userId = document.getElementById("user-id").value

  // Xử lý gửi form
  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    const saveButton = document.querySelector(".btn-save-user")
    const originalButtonText = saveButton.textContent
    saveButton.textContent = "Đang lưu..."
    saveButton.disabled = true

    try {
      // Lấy dữ liệu từ form
      if (userId) {
        // Cập nhật người dùng hiện có
        const formData = new FormData()
        formData.append("name", document.getElementById("name").value)
        formData.append("role", document.getElementById("role").value)

        // Xử lý ảnh đại diện
        const photoInput = document.getElementById("photo")
        if (photoInput && photoInput.files && photoInput.files.length > 0) {
          formData.append("photo", photoInput.files[0])
        }

        await updateUser(userId, formData)
      }
    } catch (err) {
      console.error("Lỗi trong quá trình gửi form:", err)
      showAlert("error", err.message || "Đã xảy ra lỗi khi lưu thông tin người dùng")
    } finally {
      saveButton.textContent = originalButtonText
      saveButton.disabled = false
    }
  })
}

// Xử lý vô hiệu hóa người dùng
export const handleDeactivateUser = () => {
  const deactivateButtons = document.querySelectorAll(".btn-deactivate-user")

  deactivateButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const userId = e.target.dataset.userId
      console.log("Nút vô hiệu hóa được nhấp cho ID người dùng:", userId)

      if (confirm("Bạn có chắc chắn muốn vô hiệu hóa người dùng này?")) {
        await deactivateUser(userId)
      }
    })
  })
}

// Xử lý kích hoạt người dùng
export const handleActivateUser = () => {
  const activateButtons = document.querySelectorAll(".btn-activate-user")

  activateButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const userId = e.target.dataset.userId
      console.log("Nút kích hoạt được nhấp cho ID người dùng:", userId)

      if (confirm("Bạn có chắc chắn muốn kích hoạt người dùng này?")) {
        await activateUser(userId)
      }
    })
  })
}
