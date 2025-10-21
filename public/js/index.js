/* eslint-disable */
import "@babel/polyfill"
import { login, logout } from "./login"
import { updateSettings } from "./updateSettings"
import { signup } from "./signup"
import { bookTour } from "./stripe"
import { handleTourForm, handleDeleteTour } from "./tourManagement"
import { handleUserForm, handleDeactivateUser, handleActivateUser } from "./userManagement"
import {
  handleDeleteBooking,
  handleUpdateBookingPaymentStatus,
  initBookingFilter,
  handleTogglePaymentStatus,
} from "./bookingManagement"
import { initViewToggle } from "./viewToggle"
import { initBookingForm } from "./bookingForm"
import { handleDeleteReview, handleEditReview, initReviewFilter } from "./reviewManagement"
import { initBookingSuccess } from "./bookingSuccess"
import { handleAddReview, handlePrintInvoice } from "./myTours"
import { initMyBilling } from "./myBilling"
import { initMyReviews } from "./myReviews"
import { initFileInputs } from "./updateSettings"
import { forgotPassword, resetPassword } from "./forgotPassword"
import { displayMap } from './mapbox';

// DOM ELEMENTS
const loginForm = document.querySelector(".form--login")
const signupForm = document.querySelector(".form--signup")
const logOutBtn = document.querySelector(".nav__el--logout")
const userDataForm = document.querySelector(".form-user-data")
const userPasswordForm = document.querySelector(".form-user-password")
const bookBtn = document.getElementById("book-tour")
const bookTourBtns = document.querySelectorAll(".book-tour-btn")
const tourForm = document.querySelector(".form-tour")
const tourManagementList = document.querySelector(".tour-management__list")
const userForm = document.querySelector(".form-user")
const userManagementList = document.querySelector(".user-management__list")
const bookingManagementList = document.querySelector(".booking-management__list")
const forgotPasswordForm = document.querySelector(".form--forgot-password")
const resetPasswordForm = document.querySelector(".form--reset-password")

// Khởi tạo hiển thị tên file sau khi chọn
initFileInputs()

// DELEGATION
if (loginForm)
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault()
    const email = document.getElementById("email").value
    const password = document.getElementById("password").value
    login(email, password)
  })

if (signupForm)
  signupForm.addEventListener("submit", (e) => {
    e.preventDefault()
    const name = document.getElementById("name").value
    const email = document.getElementById("email").value
    const password = document.getElementById("password").value
    const passwordConfirm = document.getElementById("password-confirm").value
    signup(name, email, password, passwordConfirm)
  })

if (logOutBtn) logOutBtn.addEventListener("click", logout)

if (userDataForm)
  userDataForm.addEventListener("submit", (e) => {
    e.preventDefault()
    const form = new FormData()
    form.append("name", document.getElementById("name").value)
    form.append("email", document.getElementById("email").value)
    form.append("photo", document.getElementById("photo").files[0])
    console.log(form)

    updateSettings(form, "data")
  })

if (userPasswordForm)
  userPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault()
    document.querySelector(".btn--save-password").textContent = "Updating..."

    const passwordCurrent = document.getElementById("password-current").value
    const password = document.getElementById("password").value
    const passwordConfirm = document.getElementById("password-confirm").value
    await updateSettings({ passwordCurrent, password, passwordConfirm }, "password")

    document.querySelector(".btn--save-password").textContent = "Lưu mật khẩu"
    document.getElementById("password-current").value = ""
    document.getElementById("password").value = ""
    document.getElementById("password-confirm").value = ""
  })


if (bookBtn && !document.querySelector(".booking-main-form")) {
  bookBtn.addEventListener("click", (e) => {
    e.preventDefault();
    const { tourId } = e.target.dataset;
    if (tourId) {
      window.location.href = `/book-tour/${tourId}`;
    }
  });
}

// Xử lý nút đặt tour trực tiếp từ trang overview
if (bookTourBtns) {
  bookTourBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.target.textContent = "Đang xử lý..."
      const { tourId } = e.target.dataset
      bookTour(tourId)
    })
  })
}

if (forgotPasswordForm) {
  forgotPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault()
    document.querySelector(".btn").textContent = "Đang gửi..."

    const email = document.getElementById("email").value
    await forgotPassword(email)

    document.querySelector(".btn").textContent = "Gửi liên kết đặt lại"
  })
}

// Xử lý đặt lại mật khẩu
if (resetPasswordForm) {
  resetPasswordForm.addEventListener("submit", async (e) => {
    e.preventDefault()
    document.querySelector(".btn").textContent = "Đang cập nhật..."

    const password = document.getElementById("password").value
    const passwordConfirm = document.getElementById("passwordConfirm").value
    const token = document.getElementById("token").value

    await resetPassword(password, passwordConfirm, token)

    document.querySelector(".btn").textContent = "Đặt lại mật khẩu"
  })
}

// Thêm xử lý cho nút tăng/giảm số lượng người và cập nhật tổng tiền
// Thêm vào phần DELEGATION
// Xử lý tính toán tổng tiền khi thay đổi số lượng người
const participantsInput = document.getElementById("participants")
const totalPriceElement = document.getElementById("total-price")
const decreaseBtn = document.querySelector(".booking-form__btn--decrease")
const increaseBtn = document.querySelector(".booking-form__btn--increase")

if (participantsInput && totalPriceElement) {
  // Lấy giá gốc từ text và chuyển đổi thành số
  const priceText = totalPriceElement.textContent
  const tourPrice = Number.parseInt(priceText.replace(/[^\d]/g, ""), 10)

  // Hàm cập nhật tổng tiền
  const updateTotalPrice = () => {
    const participants = Number.parseInt(participantsInput.value, 10) || 1
    const totalPrice = tourPrice * participants
    totalPriceElement.textContent = `${totalPrice.toLocaleString("vi-VN")} VND`
  }

  // Cập nhật tính toán khi thay đổi số lượng người
  participantsInput.addEventListener("input", updateTotalPrice)

  // Xử lý nút giảm số lượng
  if (decreaseBtn) {
    decreaseBtn.addEventListener("click", () => {
      const currentValue = Number.parseInt(participantsInput.value, 10) || 1
      if (currentValue > 1) {
        participantsInput.value = currentValue - 1
        updateTotalPrice()
      }
    })
  }

  // Xử lý nút tăng số lượng
  if (increaseBtn) {
    increaseBtn.addEventListener("click", () => {
      const currentValue = Number.parseInt(participantsInput.value, 10) || 1
      const maxSize = document.getElementById("book-tour").dataset.maxSize
      if (currentValue < maxSize) {
        participantsInput.value = currentValue + 1
        updateTotalPrice()
      }
    })
  }
}

// Tour Management
if (tourForm) {
  handleTourForm()
}

if (tourManagementList) {
  handleDeleteTour()
}

// User Management
if (userForm) {
  handleUserForm()
}

if (userManagementList) {
  handleDeactivateUser()
  handleActivateUser()
}

// Cập nhật phần Booking Management để sử dụng hàm mới
// Booking Management
if (bookingManagementList) {
  handleDeleteBooking()
  handleTogglePaymentStatus() // Thêm dòng này
  initBookingFilter()
}

// Check if we're on the booking detail page
if (document.querySelector(".booking-detail")) {
  handleDeleteBooking()
  handleUpdateBookingPaymentStatus()
}

// Initialize view toggle and search functionality
initViewToggle()

// Initialize booking success page
if (document.querySelector('.booking-success') && typeof initBookingSuccess === 'function') {
  initBookingSuccess();
}

// Initialize review management
const reviewManagementList = document.querySelector(".review-management__list")
if (reviewManagementList) {
  handleDeleteReview()
  handleEditReview()
  initReviewFilter()
}

// Initialize my tours page
if (document.querySelector(".form-add-review")) {
  handleAddReview()
}

// Initialize booking invoice page
if (document.querySelector(".btn-print-invoice")) {
  handlePrintInvoice()
}

// Initialize my billing page
if (document.querySelector(".billing-list")) {
  initMyBilling()
}

// Initialize my reviews page
if (document.querySelector(".reviews-list")) {
  initMyReviews()
}

// Thêm code để ẩn/hiện nút đặt tour cố định
document.addEventListener('DOMContentLoaded', function() {
  const fixedBtn = document.querySelector('.btn--fixed');
  const ctaSection = document.querySelector('.section-cta');

  if (fixedBtn && ctaSection) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          fixedBtn.classList.add('hide-fixed-btn');
        } else {
          fixedBtn.classList.remove('hide-fixed-btn');
        }
      });
    }, { threshold: 0.1 });

    observer.observe(ctaSection);
  }
});

const mapBox = document.getElementById('map');

if (mapBox) {
  const locations = JSON.parse(mapBox.dataset.locations);
  displayMap(locations);
}

// Header functionality
export const initHeader = () => {
  // User dropdown functionality
  const userDropdown = document.querySelector('.user-dropdown');
  const userDropdownToggle = document.querySelector('.user-dropdown__toggle');

  if (userDropdown && userDropdownToggle) {
    userDropdownToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      userDropdown.classList.toggle('active');
      // optional a11y
      userDropdownToggle.setAttribute('aria-expanded', userDropdown.classList.contains('active'));
    });

    document.addEventListener('click', (e) => {
      if (!userDropdown.contains(e.target)) {
        userDropdown.classList.remove('active');
        userDropdownToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
  
  // Smooth scroll to footer for contact and about links
  const scrollLinks = document.querySelectorAll('[data-scroll="footer"]');
  scrollLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const footer = document.querySelector('footer') || document.querySelector('.footer');
      if (footer) {
        footer.scrollIntoView({ 
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
  
  // Search functionality
  const searchInput = document.querySelector('.search-input');
  const searchBtn = document.querySelector('.search-btn');
  
  if (searchInput && searchBtn) {
    const handleSearch = () => {
      const query = searchInput.value.trim();
      if (query) {
        window.location.href = `/tours?search=${encodeURIComponent(query)}`;
      }
    };
    
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    });
    
    // Search suggestions (optional enhancement)
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      
      if (query.length >= 2) {
        searchTimeout = setTimeout(() => {
          // You can implement search suggestions here
          // showSearchSuggestions(query);
        }, 300);
      }
    });
  }
  
  // Mobile menu toggle
  const mobileToggle = document.querySelector('.mobile-menu-toggle');
  const nav = document.querySelector('.nav--tours');
  
  if (mobileToggle && nav) {
    mobileToggle.addEventListener('click', () => {
      nav.classList.toggle('nav--mobile-active');
      mobileToggle.classList.toggle('active');
    });
  }
  
  // Header scroll effect (optional)
  let lastScrollTop = 0;
  const header = document.querySelector('.header');
  
  window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > lastScrollTop && scrollTop > 100) {
      // Scrolling down
      header.style.transform = 'translateY(-100%)';
    } else {
      // Scrolling up
      header.style.transform = 'translateY(0)';
    }
    
    lastScrollTop = scrollTop;
  });
  
  // Add scroll transition
  header.style.transition = 'transform 0.3s ease-in-out';
};

// Logout functionality
export const handleLogout = () => {
  const logoutBtn = document.querySelector('.logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      
      if (confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
        // Call your existing logout function
        if (typeof logout === 'function') {
          logout();
        } else {
          fetch('/api/v1/users/logout', { credentials: 'same-origin' })
            .finally(() => location.assign('/'));
        }
      }
    });
  }
};

// Initialize header when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  handleLogout();
});