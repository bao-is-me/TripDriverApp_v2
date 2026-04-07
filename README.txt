# TripDriverApp_v2

TripDriverApp_v2 là ứng dụng thuê xe tự lái đa vai trò, xây dựng bằng **React + TypeScript + Vite**, đóng gói Android bằng **Capacitor**, và kết nối dữ liệu thật qua **Supabase**.

Ứng dụng mô phỏng và triển khai luồng thuê xe tự lái với 3 vai trò chính:

- **Renter**: người thuê xe
- **Owner**: chủ xe
- **Admin**: quản trị nền tảng

---

## 1. Mục tiêu dự án

Dự án được xây dựng để hỗ trợ quy trình thuê xe tự lái theo mô hình nền tảng trung gian.

Điểm cốt lõi của hệ thống:

- Người thuê chọn xe và tạo booking
- Người thuê thanh toán **tiền cọc 20%** cho nền tảng
- Admin kiểm tra và duyệt thanh toán cọc
- Sau khi admin duyệt, chủ xe mới được xác nhận hoặc từ chối booking
- Khi booking được xác nhận, hai bên tiếp tục nhận xe, trả xe và hoàn tất chuyến đi
- Sau khi chuyến đi hoàn thành, người thuê có thể đánh giá xe

---

## 2. Công nghệ sử dụng

### Frontend
- React
- TypeScript
- Vite

### Mobile wrapper
- Capacitor
- Android (Gradle)

### Backend / Data
- Supabase
  - Authentication
  - Database
  - Realtime/session support theo phiên đăng nhập

---

## 3. Kiến trúc tổng quan

Project được tổ chức theo hướng tách lớp rõ ràng để dễ đọc, dễ bảo trì và dễ mở rộng:

- `src/app`: khởi tạo app, điều hướng page nội bộ
- `src/domain`: model nghiệp vụ, enum trạng thái
- `src/data`: repository interface và Supabase repository
- `src/state`: quản lý state toàn app bằng context
- `src/ui`: giao diện cho từng vai trò
- `src/core`: cấu hình asset, payment config, Supabase config
- `android/`: project Android do Capacitor quản lý

---

## 4. Vai trò người dùng

### Renter
Người thuê xe có thể:

- xem danh sách xe đang mở
- lọc xe theo hãng
- xem chi tiết xe
- tạo booking
- xem hướng dẫn thanh toán tiền cọc
- xác nhận đã chuyển khoản
- theo dõi trạng thái booking
- xác nhận đã nhận xe
- xác nhận đã trả xe
- gửi đánh giá sau khi chuyến đi hoàn tất
- cập nhật hồ sơ cá nhân

### Owner
Chủ xe có thể:

- xem dashboard tổng quan
- xem danh sách xe của mình
- thêm xe mới
- bật / tắt trạng thái hiển thị xe
- xem booking liên quan đến xe của mình
- xác nhận hoặc từ chối booking sau khi admin duyệt cọc
- hoàn tất chuyến đi
- xem doanh thu, phí nền tảng và phần nhận về

### Admin
Quản trị viên có thể:

- xem dashboard hệ thống
- xem các booking đang chờ kiểm tra thanh toán cọc
- duyệt hoặc từ chối thanh toán cọc
- xem danh sách người dùng
- xem danh sách xe
- xem thống kê doanh thu nền tảng

---

## 5. Luồng nghiệp vụ chính

### Bước 1: Người thuê tạo booking
Người thuê chọn xe, nhập thời gian thuê và tạo booking.

### Bước 2: Booking chờ đặt cọc
Hệ thống tạo booking với trạng thái chờ thanh toán cọc.

### Bước 3: Người thuê chuyển khoản cọc
Người thuê xem thông tin chuyển khoản và bấm xác nhận đã thanh toán.

### Bước 4: Admin kiểm tra thanh toán
Admin xem booking chờ duyệt và quyết định:

- duyệt cọc
- hoặc từ chối cọc

### Bước 5: Owner xác nhận booking
Nếu admin duyệt cọc, booking chuyển sang bước chờ chủ xe xác nhận.  
Owner lúc này có thể:

- chấp nhận booking
- hoặc từ chối booking

### Bước 6: Bắt đầu chuyến đi
Sau khi owner xác nhận, booking chuyển sang trạng thái đã xác nhận.  
Người thuê có thể xác nhận đã nhận xe.

### Bước 7: Kết thúc chuyến đi
Người thuê xác nhận đã trả xe, sau đó owner hoàn tất chuyến đi.

### Bước 8: Đánh giá
Khi booking hoàn tất, người thuê có thể để lại review cho xe.

---

## 6. Các trạng thái chính trong hệ thống

### Trạng thái xe
- `active`: xe đang mở để thuê
- `held`: xe đang bị giữ chỗ
- `rented`: xe đang trong chuyến đi
- `deactive`: xe đang tắt / không hiển thị

### Trạng thái booking
- `pendingDeposit`
- `pendingAdminPaymentReview`
- `pendingOwnerConfirmation`
- `confirmed`
- `inProgress`
- `pendingOwnerCompletion`
- `completed`
- `rejectedByOwner`
- `cancelled`
- `expired`

### Trạng thái thanh toán
- `pending`
- `paid`
- `failed`
- `refunded`

---

## Run Locally

```bash
npm install
npm run dev