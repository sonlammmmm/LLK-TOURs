/* eslint-disable */
export const initMyBilling = () => {
  const searchInput = document.querySelector(".billing-search")
  const statusFilter = document.querySelector(".billing-status")
  const billingItems = document.querySelectorAll(".billing-item")

  if (!searchInput || !statusFilter || billingItems.length === 0) return

  const filterBillings = () => {
    const searchTerm = searchInput.value.toLowerCase()
    const statusValue = statusFilter.value

    billingItems.forEach((item) => {
      const tourName = item.querySelector(".billing-item__tour").textContent.toLowerCase()
      const isPaid = item.querySelector(".billing-status--paid") !== null

      let shouldShow = tourName.includes(searchTerm)

      if (shouldShow && statusValue) {
        if (statusValue === "paid") {
          shouldShow = isPaid
        } else if (statusValue === "unpaid") {
          shouldShow = !isPaid
        }
      }

      item.style.display = shouldShow ? "block" : "none"
    })

    // Hiển thị thông báo nếu không có kết quả
    const billingList = document.querySelector(".billing-list")
    const emptyMessage = document.querySelector(".billing-empty")

    if (!emptyMessage && Array.from(billingItems).every((item) => item.style.display === "none")) {
      const emptyEl = document.createElement("div")
      emptyEl.className = "billing-empty empty-tours billing-empty--filter"
      emptyEl.innerHTML = "<p class='empty-tours-text'>Không tìm thấy hóa đơn nào phù hợp.</p>"
      billingList.appendChild(emptyEl)
    } else if (emptyMessage && emptyMessage.classList.contains("billing-empty--filter")) {
      if (Array.from(billingItems).some((item) => item.style.display === "block")) {
        emptyMessage.remove()
      }
    }
  }

  searchInput.addEventListener("input", filterBillings)
  statusFilter.addEventListener("change", filterBillings)
}
