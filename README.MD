# TripDriverApp_v2

TripDriverApp_v2 là ứng dụng thuê xe tự lái đa vai trò, được xây dựng bằng **React + TypeScript + Vite**, đóng gói Android bằng **Capacitor**, và kết nối với **Supabase** để xử lý xác thực và dữ liệu.

Ứng dụng được thiết kế theo mô hình nền tảng trung gian, trong đó người thuê tạo booking, thanh toán **20% tiền cọc** cho nền tảng, admin kiểm tra thủ công giao dịch cọc, và chủ xe chỉ xác nhận hoặc từ chối đơn sau khi bước duyệt cọc hoàn tất.

---

## Tổng quan

Dự án triển khai luồng thuê xe tự lái với 3 vai trò chính:

- **Renter** – Người thuê xe
- **Owner** – Chủ xe
- **Admin** – Quản trị viên

Ứng dụng được tổ chức theo hướng mobile-first, có phân tách màn hình theo vai trò và có lớp quản lý state tập trung. Phiên bản hiện tại đã bao gồm các bước chính như tạo booking, thanh toán cọc, duyệt cọc, xác nhận đơn, hoàn tất chuyến đi và đánh giá sau chuyến.

---

## Vai trò người dùng

### Renter
Người thuê có thể:

- xem danh sách xe
- lọc xe theo hãng
- xem chi tiết xe
- tạo booking
- xem hướng dẫn thanh toán cọc
- xác nhận đã chuyển khoản tiền cọc
- theo dõi trạng thái booking
- xác nhận nhận xe
- xác nhận trả xe
- gửi đánh giá sau khi hoàn tất chuyến đi
- cập nhật thông tin cá nhân

### Owner
Chủ xe có thể:

- xem dashboard
- xem danh sách xe của mình
- tạo xe mới
- bật / tắt hiển thị xe
- xem các booking liên quan đến xe của mình
- xác nhận hoặc từ chối booking sau khi admin duyệt cọc
- hoàn tất chuyến đi sau khi người thuê trả xe
- xem các giá trị doanh thu như phí nền tảng và phần thu của chủ xe

### Admin
Quản trị viên có thể:

- xem dashboard hệ thống
- kiểm tra các booking đang chờ duyệt cọc
- duyệt hoặc từ chối thanh toán cọc
- xem danh sách người dùng
- xem danh sách xe
- xem tổng quan doanh thu từ các booking

---

## Luồng nghiệp vụ chính

Ứng dụng hiện tại vận hành theo luồng sau:

1. **Người thuê tạo booking**  
   Người thuê chọn xe, chọn ngày thuê và tạo booking.

2. **Booking chuyển sang bước thanh toán cọc**  
   Đơn thuê bắt đầu ở trạng thái chờ xử lý cọc.

3. **Người thuê chuyển khoản tiền cọc**  
   Ứng dụng hiển thị thông tin chuyển khoản và mã QR. Sau đó người thuê xác nhận đã thanh toán.

4. **Admin kiểm tra giao dịch cọc thủ công**  
   Admin có thể duyệt hoặc từ chối khoản cọc đó.

5. **Owner xác nhận hoặc từ chối booking**  
   Chỉ sau khi admin duyệt cọc thì booking mới chuyển đến bước chờ chủ xe xác nhận.

6. **Bắt đầu chuyến đi**  
   Sau khi chủ xe xác nhận, người thuê có thể xác nhận đã nhận xe.

7. **Kết thúc chuyến đi**  
   Người thuê xác nhận đã trả xe, sau đó chủ xe hoàn tất chuyến đi.

8. **Đánh giá sau chuyến đi**  
   Sau khi hoàn tất, người thuê có thể gửi review.

---

## Trạng thái trong hệ thống

### Trạng thái xe
- `active`
- `held`
- `rented`
- `deactive`

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

## Các tính năng đã triển khai

Phiên bản hiện tại đã có các chức năng chính sau:

- luồng ứng dụng theo 3 vai trò renter / owner / admin
- xác thực và khôi phục phiên đăng nhập bằng Supabase
- quản lý state tập trung bằng React context
- lớp truy cập dữ liệu theo mô hình repository
- xem danh sách xe và chi tiết xe
- tạo booking
- hiển thị hướng dẫn thanh toán cọc
- luồng admin duyệt cọc thủ công
- owner xác nhận / từ chối booking
- renter xác nhận nhận xe và trả xe
- owner hoàn tất chuyến đi
- renter gửi đánh giá
- cập nhật hồ sơ cá nhân
- owner tạo xe mới
- owner bật / tắt hiển thị xe
- admin xem doanh thu
- tích hợp Android project qua Capacitor

---

## Công nghệ sử dụng

### Frontend
- React
- TypeScript
- Vite

### Mobile Packaging
- Capacitor
- Android (Gradle)

### Backend / Data
- Supabase
  - Authentication
  - Database
  - session restore

---

## Cấu trúc project

```txt
src/
  app/        # khởi tạo ứng dụng và định nghĩa các trang nội bộ
  core/       # assets, payment config, Supabase config
  data/       # interface repository và implementation bằng Supabase
  domain/     # model nghiệp vụ và enum trạng thái
  state/      # app context và xử lý action theo vai trò
  ui/         # các màn hình renter, owner, admin và shared UI

android/      # project Android của Capacitor
supabase/     # SQL migration và script hotfix
