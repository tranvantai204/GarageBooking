<div align="center">
  <img src="https://img.icons8.com/clouds/200/bus.png" alt="Bus Icon" width="120" />

  # 🚍 Hà Phương Bus App - Backend API
  
  **Hệ thống API RESTful cung cấp dữ liệu cho Ứng dụng Đặt vé xe khách Hà Phương.**

  [![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg?style=for-the-badge&logo=node.js)](https://nodejs.org/)
  [![Express.js](https://img.shields.io/badge/Express.js-4.18-lightgrey.svg?style=for-the-badge&logo=express)](https://expressjs.com/)
  [![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
</div>

---

## 🌟 Giới thiệu

Đây là Backend Server cung cấp API cho ứng dụng **Hà Phương Bus** (Garage Booking). Hệ thống được xây dựng bằng **Node.js** và **Express.js**, hiện tại sử dụng kiến trúc dữ liệu trong bộ nhớ (In-memory) phù hợp cho việc demo, thử nghiệm và phát triển giao diện nhanh chóng. Hệ thống bao gồm đầy đủ các tính năng cơ bản như Xác thực người dùng, Quản lý chuyến đi, Đặt vé, và Hệ thống Chat nội bộ.

---

## ✨ Tính năng nổi bật (Features)

- 🔐 **Xác thực & Phân quyền**: Hỗ trợ đăng nhập, đăng ký bằng JWT (JSON Web Token) và mã hóa mật khẩu an toàn với `bcryptjs`.
- 🚌 **Quản lý Chuyến xe**: Danh sách chuyến đi, tìm kiếm chuyến xe linh hoạt theo điểm đi, điểm đến và ngày khởi hành.
- 🎟️ **Quản lý Đặt vé (Booking)**: Đặt vé, hủy vé, và xem danh sách vé đã đặt.
- 💬 **Hệ thống Chat**: Hỗ trợ phòng chat, nhắn tin thời gian thực giả lập giữa các người dùng (Tài xế & Hành khách, Admin & Khách hàng), cho phép thu hồi tin nhắn.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **Runtime Environment**: Node.js (>= 18.0.0)
- **Framework**: Express.js
- **Security & Utilities**: 
  - `jsonwebtoken`: Cấp phát JWT cho bảo mật API.
  - `bcryptjs`: Hash mật khẩu người dùng.
  - `cors`: Hỗ trợ Cross-Origin Resource Sharing.
- **Development Tools**: `nodemon` để tự động restart server trong quá trình code.

---

## 🚀 Cài đặt & Khởi chạy (Getting Started)

### 1. Yêu cầu hệ thống (Prerequisites)
- [Node.js](https://nodejs.org/en/) phiên bản >= 18.0.0 đã được cài đặt trên máy.

### 2. Các bước cài đặt

Mở terminal, di chuyển vào thư mục `server` và chạy lệnh sau để cài đặt các package cần thiết:

```bash
cd server
npm install
```

### 3. Khởi động Server

**Môi trường phát triển (Development Mode):**
Dùng lệnh này khi bạn muốn server tự động chạy lại mỗi khi bạn sửa code:
```bash
npm run dev
```

**Môi trường sản xuất (Production Mode):**
```bash
npm start
```

Mặc định, server sẽ chạy tại địa chỉ: `http://localhost:3000`

---

## 📡 Tổng quan API Endpoints

Dưới đây là các API endpoint chính được cung cấp bởi hệ thống. 
*Lưu ý: Header của đa số các request cần có `Authorization: Bearer <token>` nhận được sau khi đăng nhập.*

### 🔑 Xác thực (Authentication)
| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Đăng nhập tài khoản |
| `POST` | `/api/auth/register` | Đăng ký tài khoản mới |
| `GET` | `/api/auth/users` | Lấy danh sách người dùng (Không bao gồm mật khẩu) |
| `PUT` | `/api/auth/users/:id` | Cập nhật thông tin tài khoản |

### 🚌 Chuyến xe (Trips)
| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/trips` | Lấy danh sách tất cả các chuyến xe hiện có |
| `GET` | `/api/trips/search` | Tìm kiếm chuyến xe (Hỗ trợ params: `diemDi`, `diemDen`, `ngayDi`) |

### 🎫 Đặt vé (Bookings)
| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/bookings` | Lấy danh sách các vé đã đặt trong hệ thống |
| `POST` | `/api/bookings` | Tạo đặt vé mới cho người dùng |
| `DELETE` | `/api/bookings/:id` | Hủy một vé đã đặt |

### 💬 Hệ thống Chat (Chat System)
| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/chat/rooms/:userId` | Lấy danh sách phòng chat của một người dùng |
| `GET` | `/api/chat/messages/:roomId`| Lấy toàn bộ tin nhắn trong một phòng chat |
| `POST` | `/api/chat/room` | Tạo mới một phòng chat |
| `POST` | `/api/chat/send` | Gửi tin nhắn mới vào phòng |
| `DELETE`| `/api/chat/messages/:messageId`| Thu hồi một tin nhắn đã gửi |

### 💓 Khác
| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Kiểm tra trạng thái hoạt động của server |

---

## 👥 Tài khoản Demo (Demo Accounts)

Hệ thống đã có sẵn các dữ liệu giả lập để bạn có thể test ngay mà không cần tốn công đăng ký:

| Vai trò | Tên hiển thị | Số điện thoại (Tài khoản) | Mật khẩu |
| :--- | :--- | :--- | :--- |
| **Admin** | Admin Hà Phương | `0123456789` | `123456` |
| **User** | Nguyễn Văn A | `0987654321` | `123456` |
| **Driver** | Trần Văn Tài | `0111222333` | `123456` |

---

## 💡 Cấu trúc thư mục & Lưu ý
- **`server.js`**: Chứa toàn bộ logic backend (Routing, Controllers, In-memory Database).
- **`package.json`**: Quản lý dependencies và scripts khởi chạy.
- *Lưu ý*: Dự án hiện dùng **In-memory storage** (Biến mảng trong RAM) nên mọi thay đổi dữ liệu (tạo user, đặt vé, gửi tin nhắn) sẽ bị reset khi bạn khởi động lại server. Trong tương lai, dự án có thể dễ dàng kết nối với Database như MongoDB (nhờ thư viện `mongoose` đã có sẵn trong `package.json`).

<br />
<div align="center">
  <sub>Được xây dựng phục vụ đồ án Tốt nghiệp / Hệ thống Garage Booking Frontend</sub>
</div>

