# 🤖 AI PROMPT – LẬP KẾ HOẠCH & VIẾT TÀI LIỆU ĐỒ ÁN KIỂM THỬ PHẦN MỀM
## Dự án: LLK-TOURs – Hệ thống Đặt Tour Du Lịch Trực Tuyến

---

## 📌 HƯỚNG DẪN SỬ DỤNG FILE NÀY

File này là **master prompt** dành cho AI (Claude, ChatGPT, Gemini,...) để tạo ra toàn bộ tài liệu đồ án học phần **Kiểm thử & Đảm bảo Chất lượng Phần mềm**. Đọc kỹ phần **Ngữ cảnh Dự án** trước, sau đó sử dụng từng **Task Prompt** theo thứ tự để sinh ra từng chương tài liệu.

---

## 🏗️ PHẦN 1 – NGỮ CẢNH DỰ ÁN (Cung cấp cho AI trước mọi yêu cầu)

### Mô tả hệ thống

**Tên hệ thống:** LLK-TOURs  
**Loại:** Website đặt tour du lịch trực tuyến (Hệ thống đặt lịch dịch vụ – Đề tài số 20/31)  
**Công nghệ:** Node.js (Express), Pug (template engine), MongoDB, Socket.IO, Stripe/MoMo payment, Mapbox, Selenium/Playwright cho automation testing  
**Môi trường:** Web app chạy trên Node.js server, database MongoDB

### Cấu trúc dự án (File Tree)

```
LLK-TOURs/
├── config/           # database.js, middlewares.js, processHandlers.js, securityHeaders.js
├── controllers/      # authController, bookingController, contactController, errorController,
│                     # faqController, handlerFactory, messageController, promotionController,
│                     # reviewController, serviceController, siteSettingController,
│                     # tourController, userController, viewsController
├── routes/           # bookingRoutes, contactRoutes, faqRoutes, messageRoutes,
│                     # promotionRoutes, reviewRoutes, serviceRoutes, siteSettingRoutes,
│                     # tourRoutes, userRoutes, viewRoutes
├── schemas/          # bookingHoldModel, bookingModel, contactMessageModel, faqModel,
│                     # messageModel, promotionModel, reviewModel, serviceModel,
│                     # siteSettingModel, tourModel, userModel, userPromotionModel
├── utils/            # apiFeatures, appError, bookingPayments, bookingPricing,
│                     # bookingSoftLock, catchAsync, dashboardFeed, email,
│                     # promotionEngine, realtime, servicePricing, socketServer
├── views/            # Pug templates: tour, bookingForm, bookingDetail, bookingSuccess,
│                     # bookingInvoice, login, signup, account, dashboard, contact,
│                     # manageBookings, manageTours, manageUsers, manageReviews,
│                     # managePromotions, manageFaqs, manageServices, adminChat, chat...
├── public/           # CSS, JS (client-side), images
├── app.js
└── server.js
```

### Các chức năng chính của hệ thống

| Module | Chức năng |
|--------|-----------|
| **Auth** | Đăng ký, đăng nhập, đăng xuất, quên mật khẩu, reset mật khẩu |
| **Tour** | Xem danh sách tour, xem chi tiết tour, tìm kiếm/lọc tour |
| **Booking** | Đặt tour, chọn dịch vụ bổ sung, thanh toán (Stripe/MoMo), xem lịch sử đặt tour |
| **Review** | Viết đánh giá, xem đánh giá, quản lý đánh giá (admin) |
| **Promotion** | Áp mã khuyến mãi khi đặt tour, quản lý khuyến mãi (admin) |
| **User Portal** | Cập nhật thông tin cá nhân, đổi ảnh đại diện, xem đơn hàng, hóa đơn |
| **Admin Dashboard** | Thống kê, quản lý tour, người dùng, booking, FAQ, cài đặt site |
| **Chat** | Chat realtime giữa user và admin (Socket.IO) |
| **Contact** | Gửi liên hệ/yêu cầu hỗ trợ |

### Đối tượng sử dụng

- **Khách hàng (User):** Người dùng đặt tour, thanh toán, đánh giá
- **Quản trị viên (Admin):** Quản lý toàn bộ hệ thống
- **Khách vãng lai (Guest):** Xem tour, không đặt được

---

## 📋 PHẦN 2 – YÊU CẦU ĐỒ ÁN (Rubric & cấu trúc báo cáo)

### Rubric chấm điểm

| Tiêu chí | Mô tả | Điểm |
|----------|-------|------|
| Giới thiệu & phân tích hệ thống | Rõ ràng, đúng phạm vi | 1đ |
| Test Plan | Đầy đủ, logic | 2đ |
| Test-case Black-box | Đủ 4 kỹ thuật trên 4 chức năng | 2đ |
| Test-case White-box | Đúng CFG, đủ 4 mức độ bao phủ | 2đ |
| Thực hiện & quản lý bug | Thực thi, báo cáo lỗi | 1đ |
| Automation testing | Demo, chạy được | 2đ |
| **Tổng** | | **10đ** |

---

## 🚀 PHẦN 3 – TASK PROMPTS (Dùng từng task riêng lẻ để yêu cầu AI viết)

> **Hướng dẫn:** Copy toàn bộ **Phần 1 (Ngữ cảnh)** + **task prompt tương ứng** rồi gửi cho AI.

---

### TASK 1 – Chương 1: Tổng quan hệ thống (10%)

```
Dựa vào ngữ cảnh dự án LLK-TOURs đã cung cấp, hãy viết Chương 1 – Tổng quan hệ thống
cho báo cáo đồ án Kiểm thử & Đảm bảo Chất lượng Phần mềm, bao gồm các mục:

1.1 Giới thiệu hệ thống
- Tên, mục đích, công nghệ sử dụng
- Lý do lựa chọn hệ thống để kiểm thử

1.2 Mục tiêu hệ thống
- Mục tiêu kinh doanh
- Mục tiêu kỹ thuật

1.3 Đối tượng sử dụng
- Phân loại người dùng (Guest, User, Admin)
- Mô tả quyền hạn từng vai trò

1.4 Các chức năng chính
- Bảng mô tả đầy đủ các module và chức năng

1.5 Phạm vi kiểm thử
- Những gì sẽ được kiểm thử (in-scope)
- Những gì KHÔNG kiểm thử (out-of-scope)
- Lý do giới hạn phạm vi

Định dạng: Markdown, chuyên nghiệp, tiếng Việt, phù hợp báo cáo kỹ thuật đại học.
```

---

### TASK 2 – Chương 2: Phân tích yêu cầu & Test Plan (20%)

```
Dựa vào ngữ cảnh dự án LLK-TOURs đã cung cấp, hãy viết Chương 2 – Phân tích yêu cầu
& Test Plan, bao gồm:

2.1 Danh sách yêu cầu chức năng (Functional Requirements)
- Tạo bảng với cột: Requirement ID | Mô tả | Module | Độ ưu tiên
- Liệt kê ít nhất 20 yêu cầu chức năng từ REQ-F01 đến REQ-F20+
- Bao phủ tất cả module: Auth, Tour, Booking, Review, Promotion, User, Admin, Chat

2.2 Danh sách yêu cầu phi chức năng (Non-Functional Requirements)
- Tạo bảng với cột: Requirement ID | Loại | Mô tả | Tiêu chí đánh giá
- Bao gồm: hiệu năng, bảo mật, khả dụng, khả năng mở rộng, tương thích

2.3 Requirement Traceability Matrix (RTM)
- Bảng liên kết Requirement ID với Test Case ID tương ứng

2.4 Test Plan đầy đủ theo mẫu:
- Test Objectives: Mục tiêu kiểm thử cụ thể
- Test Scope: Phạm vi (in/out of scope)
- Test Strategy: Chiến lược kiểm thử (levels, types, techniques)
- Test Environment: Môi trường (OS, browser, Node.js version, MongoDB, tools)
- Test Schedule: Lịch trình theo tuần (tuần 1-8 trước khi báo cáo tuần 9-10)
- Roles & Responsibilities: Phân công nhóm 5 người (Test Lead, Test Designer x2, Test Executor, Automation Tester)

Định dạng: Markdown với bảng rõ ràng, tiếng Việt.
```

---

### TASK 3 – Chương 3A: Black-box Test Cases (20%)

```
Dựa vào ngữ cảnh dự án LLK-TOURs đã cung cấp, hãy thiết kế Black-box Test Cases
cho Chương 3 – Thiết kế Test Case, áp dụng đủ 4 kỹ thuật:

Kỹ thuật cần áp dụng:
1. Phân lớp tương đương (Equivalence Partitioning)
2. Phân tích giá trị biên (Boundary Value Analysis)
3. Bảng điều kiện (Decision Table)
4. Chuyển trạng thái (State Transition)

Yêu cầu:
- Áp dụng 4 kỹ thuật trên ÍT NHẤT 4 chức năng sau:
  * Chức năng 1: Đăng ký tài khoản (authController - register)
  * Chức năng 2: Đăng nhập (authController - login)
  * Chức năng 3: Đặt tour (bookingController - createBooking)
  * Chức năng 4: Áp mã khuyến mãi (promotionEngine - applyPromotion)

Với mỗi chức năng:
- Xác định Test Scenario
- Liệt kê các lớp tương đương (valid/invalid)
- Xác định giá trị biên
- Vẽ bảng điều kiện hoặc biểu đồ chuyển trạng thái (dạng text/markdown)
- Tạo bảng Test Case với cột:
  TC ID | Module | Kỹ thuật | Mô tả | Dữ liệu vào | KQ mong đợi | KQ thực tế | Trạng thái

Mỗi chức năng ít nhất 8-10 test case, tổng cộng ≥ 35 test case.
Định dạng: Markdown, tiếng Việt.
```

---

### TASK 4 – Chương 3B: White-box Test Cases (20%)

```
Dựa vào ngữ cảnh dự án LLK-TOURs đã cung cấp, hãy thiết kế White-box Test Cases
cho Chương 3 – Thiết kế Test Case, bao gồm:

Yêu cầu áp dụng đủ 4 mức độ bao phủ:
1. Phủ lệnh (Statement Coverage)
2. Phủ nhánh (Branch Coverage)
3. Phủ đường (Path Coverage)
4. Phủ điều kiện (Condition Coverage)

Áp dụng trên 4 đoạn mã nguồn thực tế của dự án:

Đoạn mã 1: utils/bookingPricing.js
- Hàm tính giá booking (áp dụng giá người lớn/trẻ em, dịch vụ bổ sung)
- Vẽ Control Flow Graph (CFG) dạng text/ASCII
- Tính cyclomatic complexity
- Liệt kê các path độc lập
- Thiết kế test case cho từng mức độ bao phủ

Đoạn mã 2: utils/promotionEngine.js
- Hàm kiểm tra và áp dụng mã khuyến mãi
- Tương tự: CFG, complexity, paths, test cases

Đoạn mã 3: utils/bookingSoftLock.js
- Hàm quản lý soft-lock chỗ ngồi/slot tour
- Tương tự: CFG, complexity, paths, test cases

Đoạn mã 4: controllers/authController.js (hàm login hoặc signup)
- Hàm xử lý xác thực người dùng
- Tương tự: CFG, complexity, paths, test cases

Với mỗi đoạn mã:
- Giả định hoặc suy luận logic hàm từ tên file và ngữ cảnh hệ thống
- Viết pseudocode/code minh họa nếu cần
- Vẽ CFG (dạng text với node và edge)
- Bảng test case với: TC ID | Mức bao phủ | Path/Branch | Dữ liệu vào | KQ mong đợi | KQ thực tế | Trạng thái

Tổng cộng  15-20 white-box test case.
Định dạng: Markdown, tiếng Việt.
```

---

### TASK 5 – Chương 4: Thực hiện kiểm thử & Quản lý lỗi (10%)

```
Dựa vào ngữ cảnh dự án LLK-TOURs và các test case đã thiết kế ở Chương 3,
hãy viết Chương 4 – Thực hiện kiểm thử & Quản lý lỗi, bao gồm:

4.1 Test Execution Summary
- Bảng tổng hợp kết quả thực thi: Module | Tổng TC | Pass | Fail | Blocked | Pass Rate
- Biểu đồ/bảng thống kê theo module

4.2 Chi tiết kết quả thực thi
- Chọn 15-20 test case tiêu biểu (cả pass và fail)
- Bảng: Test Case ID | Mô tả | KQ mong đợi | KQ thực tế | Trạng thái | Ghi chú

4.3 Bug Report (ít nhất 8-10 bug)
- Bao gồm cả bug nghiêm trọng và nhỏ
- Bảng: Bug ID | Tiêu đề | Module | Mức độ (Critical/Major/Minor/Trivial) | 
         Độ ưu tiên | Bước tái hiện | KQ mong đợi | KQ thực tế | Trạng thái | Người phụ trách

Bug gợi ý cho LLK-TOURs:
- Lỗi đặt tour khi còn ít hơn 1 chỗ
- Lỗi áp mã khuyến mãi hết hạn không thông báo rõ
- Lỗi thanh toán timeout không rollback booking
- Lỗi upload ảnh đại diện quá kích thước
- Lỗi chat realtime mất kết nối không tự reconnect
- Lỗi filter tour theo giá bị sai thứ tự
- Lỗi reset mật khẩu link hết hạn không báo lỗi rõ ràng
- Lỗi hiển thị booking invoice sai ngày

4.4 Công cụ quản lý bug
- Mô tả công cụ sử dụng (GitHub Issues / Jira / Excel)
- Hướng dẫn workflow: New → Assigned → In Progress → Resolved → Closed

Định dạng: Markdown, tiếng Việt.
```

---

### TASK 6 – Chương 5: Automation Testing (20%)

```
Dựa vào ngữ cảnh dự án LLK-TOURs đã cung cấp, hãy viết Chương 5 – Kiểm thử tự động,
bao gồm:

5.1 Tổng quan Automation Testing
- Lý do chọn kiểm thử tự động
- Chiến lược automation (bao phủ chức năng nào)

5.2 Các công cụ sử dụng (ít nhất 4 công cụ):

CÔNG CỤ 1: Selenium WebDriver (Python hoặc JavaScript)
- Cài đặt và cấu hình
- Viết script kiểm thử cho chức năng: Đăng nhập (login)
- Code mẫu đầy đủ + giải thích từng bước
- Kết quả thực thi

CÔNG CỤ 2: Playwright (JavaScript/TypeScript)
- Cài đặt và cấu hình
- Viết script kiểm thử cho chức năng: Đặt tour end-to-end
- Code mẫu đầy đủ + giải thích từng bước
- Kết quả thực thi

CÔNG CỤ 3: Cypress
- Cài đặt và cấu hình
- Viết script kiểm thử cho chức năng: Đăng ký tài khoản
- Code mẫu đầy đủ + giải thích từng bước
- Kết quả thực thi

CÔNG CỤ 4: Postman / Newman (API Testing)
- Tạo Collection test các REST API endpoints
- Test cases: GET /api/tours, POST /api/bookings, POST /api/users/login
- Script kiểm tra response status, body, schema
- Kết quả thực thi với Newman CLI

5.3 Bảng tổng hợp kết quả automation
- Công cụ | Chức năng | Số test | Pass | Fail | Thời gian chạy

5.4 Nhận xét và so sánh công cụ
- Ưu/nhược điểm của từng công cụ
- Phù hợp cho loại kiểm thử nào trong dự án

Yêu cầu code:
- Code thực tế, chạy được trên dự án LLK-TOURs
- URL mặc định: http://localhost:3000
- Có comment tiếng Việt giải thích

Định dạng: Markdown với code blocks, tiếng Việt.
```

---

### TASK 7 – Kết luận & Tài liệu tham khảo

```
Dựa vào toàn bộ nội dung đồ án Kiểm thử LLK-TOURs đã thực hiện, hãy viết:

KẾT LUẬN
- Tóm tắt những gì đã thực hiện được
- Kết quả kiểm thử tổng quan (số lượng test case, bug tìm được, tỷ lệ pass)
- Đánh giá chất lượng hệ thống LLK-TOURs qua kết quả kiểm thử
- Những khó khăn gặp phải và cách giải quyết
- Bài học rút ra về quy trình kiểm thử phần mềm
- Hướng phát triển và cải thiện kiểm thử trong tương lai

TÀI LIỆU THAM KHẢO
- Liệt kê ít nhất 10 tài liệu tham khảo
- Bao gồm: sách giáo khoa kiểm thử, tài liệu Selenium/Playwright/Cypress, 
  IEEE standards, ISTQB glossary, tài liệu Node.js testing
- Định dạng: [Số thứ tự] Tên tác giả. (Năm). Tên tài liệu. Nguồn/NXB. URL

Định dạng: Markdown, tiếng Việt.
```

---

### TASK 8 – Trang bìa & Mục lục

```
Tạo trang bìa và mục lục cho báo cáo đồ án Kiểm thử & Đảm bảo Chất lượng Phần mềm:

TRANG BÌA (dạng Markdown):
- Trường: [Điền tên trường]
- Khoa: [Điền tên khoa]
- Học phần: Kiểm thử & Đảm bảo Chất lượng Phần mềm
- Tên đề tài: Kiểm thử Hệ thống Đặt Tour Du Lịch Trực Tuyến – LLK-TOURs
- Nhóm: [Điền số nhóm]
- Thành viên nhóm: [Điền 5 tên]
- Giảng viên hướng dẫn: [Điền tên GV]
- Năm học: 2024-2025

MỤC LỤC tự động (dựa trên cấu trúc báo cáo):
- Liệt kê đầy đủ các chương, mục, tiểu mục với số trang ước tính
- Danh sách bảng biểu
- Danh sách hình vẽ

Định dạng: Markdown.
```

---

## 📊 PHẦN 4 – QUICK REFERENCE

### Mapping chức năng → File nguồn

| Chức năng | Controller | Route | Schema | View |
|-----------|-----------|-------|--------|------|
| Đăng ký/Đăng nhập | authController.js | userRoutes.js | userModel.js | login.pug, signup.pug |
| Xem tour | tourController.js | tourRoutes.js | tourModel.js | tour.pug, all.pug |
| Đặt tour | bookingController.js | bookingRoutes.js | bookingModel.js | bookingForm.pug |
| Thanh toán | bookingPayments.js | bookingRoutes.js | bookingModel.js | bookingSuccess.pug |
| Đánh giá | reviewController.js | reviewRoutes.js | reviewModel.js | myReviews.pug |
| Khuyến mãi | promotionController.js | promotionRoutes.js | promotionModel.js | myPromotions.pug |
| Chat | messageController.js | messageRoutes.js | messageModel.js | chat.pug |
| Admin quản lý | userController.js | userRoutes.js | userModel.js | manageUsers.pug |

### URL Endpoints chính cho Automation Testing

```
GET  /                          → Trang chủ
GET  /tours                     → Danh sách tour
GET  /tours/:slug               → Chi tiết tour
GET  /login                     → Trang đăng nhập
GET  /signup                    → Trang đăng ký
GET  /book/:tourId              → Form đặt tour
GET  /my-tours                  → Lịch sử tour của tôi
GET  /my-reviews                → Đánh giá của tôi
GET  /my-billing                → Hóa đơn của tôi

API:
POST /api/v1/users/login        → Đăng nhập
POST /api/v1/users/signup       → Đăng ký
GET  /api/v1/tours              → Lấy danh sách tour
POST /api/v1/bookings           → Tạo booking
POST /api/v1/bookings/checkout-session/:tourId → Thanh toán Stripe
GET  /api/v1/reviews            → Lấy đánh giá
POST /api/v1/reviews            → Tạo đánh giá
```

### Dữ liệu test gợi ý

```javascript
// Tài khoản test
validUser = {
  email: "testuser@llktours.com",
  password: "Test@12345",
  name: "Nguyen Van Test"
}

invalidCases = {
  email: ["notanemail", "test@", "@domain.com", ""],
  password: ["123", "abc", "", "a".repeat(200)],
  name: ["", "A", "x".repeat(200)]
}

// Booking test data
validBooking = {
  tourId: "tour-phuquoc",
  date: "2025-08-15",
  adults: 2,
  children: 1
}

// Promotion codes
validPromo = "SUMMER2025"
expiredPromo = "EXPIRED2024"
invalidPromo = "NOTEXIST999"
```

---

## ✅ CHECKLIST HOÀN THÀNH ĐỒ ÁN

- [ ] **Task 1** – Chương 1: Tổng quan hệ thống (10%)
- [ ] **Task 2** – Chương 2: Test Plan & Phân tích yêu cầu (20%)
- [ ] **Task 3** – Chương 3A: Black-box Test Cases (20%)
- [ ] **Task 4** – Chương 3B: White-box Test Cases (20%)
- [ ] **Task 5** – Chương 4: Thực thi & Bug Report (10%)
- [ ] **Task 6** – Chương 5: Automation Testing (20%)
- [ ] **Task 7** – Kết luận & Tài liệu tham khảo
- [ ] **Task 8** – Trang bìa & Mục lục
- [ ] Ghép toàn bộ thành 1 file báo cáo hoàn chỉnh
- [ ] Review và chỉnh sửa
- [ ] Export sang Word/PDF để nộp

---

## 💡 MẸO SỬ DỤNG AI HIỆU QUẢ

1. **Cung cấp đủ ngữ cảnh:** Luôn paste Phần 1 (Ngữ cảnh dự án) kèm theo task prompt
2. **Yêu cầu format cụ thể:** Mỗi task đã chỉ rõ format Markdown, bảng biểu
3. **Chia nhỏ task lớn:** Nếu AI trả về ngắn, yêu cầu "tiếp tục viết phần X"
4. **Kiểm tra logic:** Đảm bảo Test Case ID nhất quán giữa các chương (TC-BB-001, TC-WB-001...)
5. **Tùy chỉnh:** Điều chỉnh tên thành viên, tên trường, tên GV trước khi nộp
6. **Code automation:** Test code với môi trường local trước khi đưa vào báo cáo

---

*File này được tạo để hỗ trợ nhóm sinh viên thực hiện đồ án Kiểm thử & ĐBCLPM – LLK-TOURs*
