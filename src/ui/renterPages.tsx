import { useEffect, useState } from 'react'

import { AppPage } from '../app/appPage'
import { AppAssets } from '../core/appAssets'
import { PaymentConfig } from '../core/paymentConfig'
import {
  BookingStatus,
  UserRole,
  bookingDays,
  effectiveHoldExpiresAt,
} from '../domain/models'
import { useTripDriver } from '../state/TripDriverContext'
import {
  AdminBottomNav,
  BookingCard,
  Card,
  CarCard,
  HeroImage,
  KeyValueRow,
  OwnerBottomNav,
  RenterBottomNav,
  RoleScaffold,
  StatusBadge,
  dateLabel,
  dateTimeLabel,
  money,
  statusColor,
} from './shared'
import { ProfileFieldIcon } from './profileIcons'

export function AuthPage() {
  const state = useTripDriver()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('123456')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [registerRole, setRegisterRole] = useState<UserRole>(UserRole.renter)

  return (
    <div className="auth-screen">
      <div className="auth-card card">
        <div className="auth-logo">
          <img alt="TripDriver" src={AppAssets.tripDriverLogo} />
        </div>
        <h1>{state.loginMode ? 'Đăng nhập TripDriver' : 'Tạo tài khoản TripDriver'}</h1>
        <p className="muted">
          Ứng dụng thuê xe tự lái với luồng giữ chỗ 1 giờ, duyệt cọc thủ công bởi admin
          và xác nhận cuối từ chủ xe.
        </p>
        {!state.loginMode ? (
          <>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Họ và tên" />
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Số điện thoại" />
            <select value={registerRole} onChange={(event) => setRegisterRole(event.target.value as UserRole)}>
              <option value={UserRole.renter}>Người thuê</option>
              <option value={UserRole.owner}>Chủ xe</option>
            </select>
          </>
        ) : null}
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
        <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mật khẩu" type="password" />
        <button
          className="primary-button"
          onClick={() =>
            state.loginMode
              ? void state.signIn(email, password)
              : void state.register({
                  fullName,
                  email,
                  phone,
                  password,
                  role: registerRole,
                })
          }
          type="button"
        >
          {state.loginMode ? 'Đăng nhập' : 'Đăng ký'}
        </button>
        <button className="secondary-button" onClick={() => state.setLoginMode(!state.loginMode)} type="button">
          {state.loginMode ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
        </button>
        <div className="info-box">
          Hãy dùng email thật để nhận thư xác minh. Nếu project đang bật xác minh email,
          bạn cần bấm link trong Gmail trước rồi mới đăng nhập được.
        </div>
      </div>
    </div>
  )
}

export function RenterHomePage() {
  const state = useTripDriver()
  const [search, setSearch] = useState('')
  const [brand, setBrand] = useState('Tất cả')

  const brands = ['Tất cả', ...new Set(state.activeCars.map((car) => car.brand))]
  const cars = state.activeCars.filter((car) => {
    const query = search.trim().toLowerCase()
    const matchesSearch =
      !query ||
      car.name.toLowerCase().includes(query) ||
      car.location.toLowerCase().includes(query) ||
      car.brand.toLowerCase().includes(query)
    const matchesBrand = brand === 'Tất cả' || car.brand === brand
    return matchesSearch && matchesBrand
  })

  return (
    <RoleScaffold
      title="TripDriver"
      subtitle="Thuê xe tự lái"
      bottomNav={<RenterBottomNav />}
      headerAction={
        <button className="secondary-button" onClick={() => void state.refreshData()} type="button">
          Làm mới
        </button>
      }
      body={
        <div className="page-stack">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo tên xe, hãng xe hoặc khu vực"
          />
          <div className="chip-row">
            {brands.map((item) => (
              <button
                key={item}
                className={`chip ${brand === item ? 'active' : ''}`}
                onClick={() => setBrand(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
          <h3>Xe đang sẵn sàng ({cars.length})</h3>
          {!cars.length ? (
            <Card className="detail-empty-state">
              <strong>Hiện chưa có xe sẵn sàng</strong>
              <p>
                Nếu bạn vừa gặp lỗi đặt xe hoặc xe đang bị giữ không đúng, hãy tải lại
                dữ liệu hoặc kiểm tra trong mục Chuyến đi của tôi.
              </p>
              <div className="stacked-actions">
                <button className="primary-button" onClick={() => void state.refreshData()} type="button">
                  Tải lại danh sách xe
                </button>
                <button className="secondary-button" onClick={() => state.goTo(AppPage.renterTrips)} type="button">
                  Xem Chuyến đi của tôi
                </button>
              </div>
            </Card>
          ) : (
            <div className="page-stack">
              {cars.map((car) => (
                <CarCard
                  key={car.id}
                  car={car}
                  rating={state.averageRatingForCar(car.id)}
                  variant="large"
                  badgeLabel="ĐANG MỞ"
                  onClick={() => state.openCar(car.id)}
                />
              ))}
            </div>
          )}
        </div>
      }
    />
  )
}

export function RenterCarDetailPage() {
  const state = useTripDriver()
  const car = state.selectedCar
  const [activeTab, setActiveTab] = useState<'info' | 'reviews'>('info')
  if (!car) {
    return null
  }
  const reviews = state.reviewsForCar(car.id)
  const avg = state.averageRatingForCar(car.id)

  return (
    <RoleScaffold
      title={car.name}
      subtitle="Xem chi tiết xe trước khi đặt"
      onBack={() => state.goTo(AppPage.renterHome)}
      floatingAction={
        <button
          className="primary-button"
          onClick={() => state.goTo(AppPage.renterCreateBooking, { carId: car.id })}
          type="button"
        >
          Thuê xe
        </button>
      }
      body={
        <div className="page-stack">
          <HeroImage imageUrl={car.primaryImage} height={220} />
          <Card className="car-detail-card">
            <div className="car-detail-top">
              <div className="car-detail-title-block">
                <h2>{car.name}</h2>
                <div className="car-detail-rating-line">
                  <span className="car-detail-star">★</span>
                  <strong>{reviews.length ? avg.toFixed(1) : 'Chưa có đánh giá'}</strong>
                  <span className="muted">
                    {reviews.length ? `(${reviews.length} đánh giá)` : 'Xe này chưa có đánh giá nào.'}
                  </span>
                </div>
              </div>
            </div>

            <div className="detail-tabs">
              <button
                className={`detail-tab ${activeTab === 'info' ? 'active' : ''}`}
                onClick={() => setActiveTab('info')}
                type="button"
              >
                Thông tin
              </button>
              <button
                className={`detail-tab ${activeTab === 'reviews' ? 'active' : ''}`}
                onClick={() => setActiveTab('reviews')}
                type="button"
              >
                Đánh giá {reviews.length ? `(${reviews.length})` : ''}
              </button>
            </div>

            {activeTab === 'info' ? (
              <div className="page-stack">
                <div className="detail-info-grid">
                  <div className="detail-info-tile">
                    <div className="detail-info-tile-label">Địa điểm</div>
                    <strong>{car.location}</strong>
                  </div>
                  <div className="detail-info-tile">
                    <div className="detail-info-tile-label">Số chỗ</div>
                    <strong>{car.seats} chỗ</strong>
                  </div>
                  <div className="detail-info-tile">
                    <div className="detail-info-tile-label">Hộp số</div>
                    <strong>{car.transmission}</strong>
                  </div>
                  <div className="detail-info-tile">
                    <div className="detail-info-tile-label">Nhiên liệu</div>
                    <strong>{car.fuel}</strong>
                  </div>
                </div>

                <div className="detail-price-card">
                  <KeyValueRow label="Hãng / Dòng xe" value={`${car.brand} ${car.model} ${car.year}`} />
                  <KeyValueRow label="Giá thuê / ngày" value={money(car.pricePerDay)} />
                  <KeyValueRow label="Cọc" value={`${car.depositPercent}%`} />
                  <KeyValueRow label="Liên hệ chủ xe" value="Chỉ hiện sau khi cọc được duyệt và chủ xe xác nhận" />
                </div>

                <div className="detail-description">
                  <h3>Mô tả</h3>
                  <p>{car.description}</p>
                </div>

                <div className="detail-gallery">
                  <div className="inline-row">
                    <h3>Hình ảnh</h3>
                    <button className="secondary-button detail-review-switch" onClick={() => setActiveTab('reviews')} type="button">
                      Xem đánh giá
                    </button>
                  </div>
                  <div className="gallery-row">
                    {state.imagesForCar(car.id).map((image) => (
                      <img className="gallery-image" key={image.id} alt="" src={image.imageUrl} />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="page-stack">
                <div className="detail-review-summary">
                  <span className="car-detail-star">★</span>
                  <strong>{reviews.length ? avg.toFixed(1) : 'Chưa có điểm'}</strong>
                  <span className="muted">
                    {reviews.length ? `${reviews.length} đánh giá` : 'Hãy là người đầu tiên đánh giá sau chuyến đi hoàn tất.'}
                  </span>
                </div>
                {reviews.length ? (
                  reviews.map((review) => (
                    <div className="review-box detail-review-box" key={review.id}>
                      <div className="inline-row">
                        <strong>{review.customerName}</strong>
                        <span className="detail-review-score">{review.rating}/5</span>
                      </div>
                      <p>{review.comment}</p>
                    </div>
                  ))
                ) : (
                  <div className="detail-empty-state">
                    <strong>Chưa có đánh giá</strong>
                    <p>Đánh giá sẽ xuất hiện ở đây sau khi chuyến đi hoàn thành và người thuê gửi nhận xét.</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      }
    />
  )
}

export function CreateBookingPage() {
  const state = useTripDriver()
  const car = state.selectedCar
  const now = new Date()
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3)
  const [startDate, setStartDate] = useState(defaultStart.toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(defaultEnd.toISOString().slice(0, 10))
  const [pickupNote, setPickupNote] = useState('')
  const [ownerNote, setOwnerNote] = useState('')

  if (!car) {
    return (
      <RoleScaffold
        title="Tạo đơn thuê"
        subtitle="Không tìm thấy xe trong phiên hiện tại"
        onBack={() => state.goTo(AppPage.renterHome)}
        body={
          <Card className="detail-empty-state">
            <strong>Xe không còn khả dụng trong phiên này</strong>
            <p>
              Xe có thể đã được giữ chỗ, hết hạn hoặc dữ liệu chưa đồng bộ. Hãy tải lại
              và thử lại từ danh sách xe.
            </p>
            <div className="stacked-actions">
              <button className="primary-button" onClick={() => void state.refreshData()} type="button">
                Tải lại
              </button>
              <button className="secondary-button" onClick={() => state.goTo(AppPage.renterHome)} type="button">
                Về trang chủ
              </button>
            </div>
          </Card>
        }
      />
    )
  }

  const start = new Date(startDate)
  const end = new Date(endDate)
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000))
  const total = car.pricePerDay * days
  const deposit = Math.round(total * 0.2)
  const remaining = total - deposit

  return (
    <RoleScaffold
      title="Tạo đơn thuê"
      subtitle="Xe sẽ được giữ chỗ trong 1 giờ sau khi đặt"
      onBack={() => state.goTo(AppPage.renterCarDetail, { carId: car.id })}
      body={
        <div className="page-stack">
          <CarCard car={car} rating={state.averageRatingForCar(car.id)} />
          <Card>
            <label className="field-group">
              <span>Ngày nhận xe</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label className="field-group">
              <span>Ngày trả xe</span>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
          </Card>
          <textarea value={pickupNote} onChange={(event) => setPickupNote(event.target.value)} placeholder="Ghi chú nhận xe" rows={2} />
          <textarea value={ownerNote} onChange={(event) => setOwnerNote(event.target.value)} placeholder="Ghi chú cho chủ xe" rows={3} />
          <Card>
            <h3>Chi tiết thanh toán</h3>
            <KeyValueRow label="Số ngày thuê" value={String(days)} />
            <KeyValueRow label="Tổng tiền" value={money(total)} />
            <KeyValueRow label="Tiền cọc (20%)" value={money(deposit)} />
            <KeyValueRow label="Còn lại" value={money(remaining)} />
          </Card>
          <button
            className="primary-button"
            onClick={() =>
              void state.createBookingDraft({
                carId: car.id,
                startDate: start,
                endDate: end,
                pickupNote,
                ownerNote,
              })
            }
            type="button"
          >
            Đặt xe và giữ chỗ trong 1 giờ
          </button>
        </div>
      }
    />
  )
}

export function DepositPaymentPage() {
  const state = useTripDriver()
  const booking = state.selectedBooking
  if (!booking) {
    return null
  }
  const car = state.carById(booking.carId)
  const payment = state.paymentForBooking(booking.id)
  if (!payment) {
    return null
  }

  return (
    <RoleScaffold
      title="Thanh toán cọc"
      subtitle="Chuyển 20% tiền cọc cho nền tảng rồi bấm xác nhận đã thanh toán"
      onBack={() => state.openBooking(booking.id, AppPage.renterBookingDetail)}
      headerAction={
        <button className="secondary-button" onClick={() => void state.refreshData()} type="button">
          Làm mới
        </button>
      }
      body={
        <div className="page-stack">
          <Card>
            <h2>{booking.code}</h2>
            <KeyValueRow label="Xe" value={car.name} />
            <KeyValueRow label="Tiền cọc" value={money(payment.amount)} />
            <KeyValueRow
              label="Nội dung chuyển khoản"
              value={payment.transferContent || PaymentConfig.transferNote(booking.code)}
            />
            <KeyValueRow label="Giữ chỗ đến" value={dateTimeLabel(effectiveHoldExpiresAt(booking))} />
          </Card>
          <Card>
            <div className="deposit-panel">
              <img alt="QR thanh toán cọc" className="deposit-qr" src={AppAssets.depositQr} />
              <strong>{PaymentConfig.bankName}</strong>
              <span>{PaymentConfig.accountNumber}</span>
              <span>{PaymentConfig.accountName}</span>
              <strong>Số tiền: {money(payment.amount)}</strong>
              <span>Nội dung: {payment.transferContent || PaymentConfig.transferNote(booking.code)}</span>
            </div>
            <p>
              Người thuê chưa được xem thông tin liên hệ của chủ xe ở bước này. Đơn sẽ chờ
              admin duyệt cọc, sau đó mới tới bước chủ xe xác nhận.
            </p>
          </Card>
          <button className="primary-button" onClick={() => void state.markDepositAsTransferred(booking.id)} type="button">
            Tôi đã thanh toán
          </button>
        </div>
      }
    />
  )
}

export function RenterTripsPage() {
  const state = useTripDriver()
  const [filter, setFilter] = useState<'all' | 'ongoing' | 'completed'>('all')
  const allBookings = state.bookingsForCurrentUser()
  const bookings = allBookings.filter((booking) => {
    switch (filter) {
      case 'ongoing':
        return [
          BookingStatus.pendingDeposit,
          BookingStatus.pendingAdminPaymentReview,
          BookingStatus.pendingOwnerConfirmation,
          BookingStatus.confirmed,
          BookingStatus.inProgress,
          BookingStatus.pendingOwnerCompletion,
        ].includes(booking.status)
      case 'completed':
        return booking.status === BookingStatus.completed
      case 'all':
      default:
        return true
    }
  })

  return (
    <RoleScaffold
      title="Chuyến đi của tôi"
      subtitle="Toàn bộ đơn thuê của tài khoản hiện tại"
      bottomNav={<RenterBottomNav />}
      headerAction={
        <button className="secondary-button" onClick={() => void state.refreshData()} type="button">
          Làm mới
        </button>
      }
      body={
        <div className="page-stack">
          <div className="detail-tabs">
            <button className={`detail-tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')} type="button">
              Tất cả ({allBookings.length})
            </button>
            <button className={`detail-tab ${filter === 'ongoing' ? 'active' : ''}`} onClick={() => setFilter('ongoing')} type="button">
              Đang diễn ra
            </button>
            <button className={`detail-tab ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')} type="button">
              Đã hoàn thành
            </button>
          </div>
          {!bookings.length ? (
            <div className="detail-empty-state">
              <strong>Chưa có đơn phù hợp</strong>
              <p>Danh sách chuyến đi sẽ hiện ở đây sau khi bạn tạo đơn thuê.</p>
            </div>
          ) : null}
          {bookings.map((booking) => {
            const car = state.carById(booking.carId)
            const owner = state.visibleOwnerProfileForBooking(booking)
            return (
              <BookingCard
                key={booking.id}
                booking={booking}
                car={car}
                statusLabel={state.bookingStatusLabel(booking.status)}
                ownerLabel={
                  state.canUserSeeOwnerInfo(booking) && owner ? owner.fullName : 'Chủ xe sẽ hiện sau khi đơn được xác nhận'
                }
                onClick={() => state.openBooking(booking.id, AppPage.renterBookingDetail)}
              />
            )
          })}
        </div>
      }
    />
  )
}

export function BookingDetailPage() {
  const state = useTripDriver()
  const booking = state.selectedBooking
  if (!booking) {
    return null
  }
  const car = state.carById(booking.carId)
  const payment = state.paymentForBooking(booking.id)
  const canSeeOwner = state.canUserSeeOwnerInfo(booking)
  const owner = state.visibleOwnerProfileForBooking(booking)
  const bookingId = booking.id
  const canReview =
    booking.status === BookingStatus.completed &&
    !state.bookingHasReview(bookingId)
  const hasReturnRequest = state.bookingHasReturnRequest(booking.id)

  function back() {
    const user = state.currentUser
    if (user?.role === UserRole.renter) {
      state.goTo(AppPage.renterTrips, { bookingId })
    } else if (user?.role === UserRole.owner) {
      state.goTo(AppPage.ownerBookings, { bookingId })
    } else {
      state.goTo(AppPage.adminRecentBookings, { bookingId })
    }
  }

  return (
    <RoleScaffold
      title={booking.code}
      subtitle={state.bookingStatusLabel(booking.status)}
      onBack={back}
      headerAction={
        <button className="secondary-button" onClick={() => void state.refreshData()} type="button">
          Làm mới
        </button>
      }
      body={
        <div className="page-stack">
          <Card>
            <StatusBadge label={state.bookingStatusLabel(booking.status)} color={statusColor(booking.status)} />
            <div className="spacer-sm" />
            <KeyValueRow label="Xe" value={car.name} />
            <KeyValueRow label="Ngày thuê" value={`${dateLabel(booking.startDate)} - ${dateLabel(booking.endDate)}`} />
            <KeyValueRow label="Số ngày" value={String(bookingDays(booking))} />
            <KeyValueRow label="Ghi chú nhận xe" value={booking.pickupNote || '-'} />
            <KeyValueRow label="Ghi chú cho chủ xe" value={booking.ownerNote || '-'} />
            <KeyValueRow label="Tổng tiền" value={money(booking.totalAmount)} />
            <KeyValueRow label="Tiền cọc" value={money(booking.depositAmount)} />
            <KeyValueRow label="Còn lại" value={money(booking.remainingAmount)} />
            {state.currentUser?.role !== UserRole.renter ? (
              <>
                <KeyValueRow label="Phí nền tảng" value={money(booking.platformFeeAmount)} />
                <KeyValueRow label="Chủ xe thực nhận" value={money(booking.ownerPayoutAmount)} />
              </>
            ) : null}
            {payment ? <KeyValueRow label="Trạng thái thanh toán" value={state.paymentStatusLabel(payment.status)} /> : null}
          </Card>
          <Card>
            <h3>Thông tin chủ xe</h3>
            {canSeeOwner && owner ? (
              <>
                <KeyValueRow label="Họ tên" value={owner.fullName} />
                <KeyValueRow label="Số điện thoại" value={owner.phone} />
                <KeyValueRow label="Thành phố" value={owner.city} />
              </>
            ) : (
              <p>Thông tin chủ xe chỉ hiện sau khi admin duyệt cọc và chủ xe xác nhận đơn.</p>
            )}
          </Card>
          <Card>
            <h3>Lịch sử trạng thái</h3>
            <div className="timeline">
              {state.historyForBooking(booking.id).map((item) => (
                <div className="timeline-item" key={item.id}>
                  <span className="timeline-dot" />
                  <div className="timeline-content">
                    <strong>{state.bookingStatusLabel(item.toStatus)}</strong>
                    {item.note ? <p>{item.note}</p> : null}
                    <span className="muted">{dateTimeLabel(item.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          {booking.status === BookingStatus.pendingDeposit ? (
            <button
              className="primary-button"
              onClick={() => state.goTo(AppPage.renterDepositPayment, { bookingId: booking.id })}
              type="button"
            >
              Tiếp tục thanh toán cọc
            </button>
          ) : null}
          {booking.status === BookingStatus.confirmed && state.currentUser?.role === UserRole.renter ? (
            <button className="primary-button" onClick={() => void state.renterMarkReceivedCar(booking.id)} type="button">
              Tôi đã nhận xe
            </button>
          ) : null}
          {canReview && state.currentUser?.role === UserRole.renter ? (
            <button className="primary-button" onClick={() => state.goTo(AppPage.renterReview, { bookingId: booking.id })} type="button">
              Viết đánh giá
            </button>
          ) : null}
          {booking.status === BookingStatus.inProgress && state.currentUser?.role === UserRole.renter && !hasReturnRequest ? (
            <button className="primary-button" onClick={() => void state.renterMarkReturnedCar(booking.id)} type="button">
              Hoàn tất trả xe
            </button>
          ) : null}
          {booking.status === BookingStatus.pendingOwnerCompletion && state.currentUser?.role === UserRole.renter ? (
            <Card>
              <p>Người thuê đã hoàn tất trả xe. Hãy chờ chủ xe xác nhận hoàn thành chuyến đi để mở quyền đánh giá.</p>
            </Card>
          ) : null}
          {state.currentUser?.role === UserRole.renter &&
          [
            BookingStatus.pendingDeposit,
            BookingStatus.pendingAdminPaymentReview,
            BookingStatus.pendingOwnerConfirmation,
            BookingStatus.confirmed,
          ].includes(booking.status) ? (
            <button className="danger-button" onClick={() => void state.cancelBooking(booking.id)} type="button">
              Hủy đơn
            </button>
          ) : null}
        </div>
      }
    />
  )
}

export function ReviewPage() {
  const state = useTripDriver()
  const booking = state.selectedBooking
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')

  if (!booking) {
    return null
  }
  const car = state.carById(booking.carId)

  return (
    <RoleScaffold
      title="Đánh giá chuyến đi"
      subtitle="Mỗi booking chỉ có thể đánh giá một lần"
      onBack={() => state.openBooking(booking.id, AppPage.renterBookingDetail)}
      body={
        <div className="page-stack">
          <Card>
            <h2>
              {car.name} | {booking.code}
            </h2>
          </Card>
          <Card>
            <div className="chip-row">
              {Array.from({ length: 5 }, (_, index) => index + 1).map((item) => (
                <button
                  key={item}
                  className={`chip ${rating === item ? 'active' : ''}`}
                  onClick={() => setRating(item)}
                  type="button"
                >
                  {item} sao
                </button>
              ))}
            </div>
            <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Nhận xét của bạn" rows={5} />
            <button
              className="primary-button"
              onClick={() => void state.submitReview({ bookingId: booking.id, rating, comment })}
              type="button"
            >
              Gửi đánh giá
            </button>
          </Card>
        </div>
      }
    />
  )
}

export function ProfilePage() {
  const state = useTripDriver()
  const user = state.currentUser
  const [isEditing, setIsEditing] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')

  useEffect(() => {
    if (!user) {
      return
    }
    setFullName(user.fullName)
    setPhone(user.phone)
    setCity(user.city)
    setAddress(user.address)
    setIsEditing(false)
  }, [user])

  if (!user) {
    return null
  }

  return (
    <RoleScaffold
      title="Tài khoản"
      subtitle=""
      onBack={() => state.goTo(profileBackPage(user.role))}
      bottomNav={
        user.role === UserRole.renter ? <RenterBottomNav /> : user.role === UserRole.owner ? <OwnerBottomNav /> : <AdminBottomNav />
      }
      body={
        <div className="page-stack">
          <Card className="profile-hero-card">
            <div className="profile-hero">
              <div className="profile-avatar">
                <ProfileFieldIcon kind="user" />
              </div>
              <div className="profile-hero-text">
                <strong>{user.fullName || 'Người dùng TripDriver'}</strong>
                <span className="muted">{roleLabel(user.role)}</span>
              </div>
            </div>
            <div className="stats-grid profile-stats-grid">
              <div className="profile-stat-pill">
                <strong>{state.bookingsForCurrentUser().length}</strong>
                <span>Đơn liên quan</span>
              </div>
              <div className="profile-stat-pill">
                <strong>
                  {user.role === UserRole.owner
                    ? state.bookingsForCurrentUser().filter((booking) => booking.status === BookingStatus.completed).length
                    : state.reviews.filter((review) => review.customerId === user.id).length}
                </strong>
                <span>{user.role === UserRole.owner ? 'Hoàn tất' : 'Đánh giá'}</span>
              </div>
              <div className="profile-stat-pill">
                <strong>{user.role.toUpperCase()}</strong>
                <span>Vai trò</span>
              </div>
            </div>
          </Card>

          <Card>
            <div className="profile-section-header">
              <h3>Thông tin cá nhân</h3>
              <button className="secondary-button profile-edit-button" onClick={() => setIsEditing(!isEditing)} type="button">
                <span className="profile-inline-icon">
                  <ProfileFieldIcon kind="edit" />
                </span>
                {isEditing ? 'Hủy chỉnh sửa' : 'Chỉnh sửa thông tin'}
              </button>
            </div>

            <div className="profile-details">
              <div className="profile-detail-row">
                <div className="profile-detail-icon">
                  <ProfileFieldIcon kind="user" />
                </div>
                <div className="profile-detail-content">
                  <span className="muted">Họ tên</span>
                  {isEditing ? (
                    <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Họ tên" />
                  ) : (
                    <strong>{fullName || '-'}</strong>
                  )}
                </div>
              </div>

              <div className="profile-detail-row">
                <div className="profile-detail-icon">
                  <ProfileFieldIcon kind="email" />
                </div>
                <div className="profile-detail-content">
                  <span className="muted">Email</span>
                  <strong>{user.email}</strong>
                </div>
              </div>

              <div className="profile-detail-row">
                <div className="profile-detail-icon">
                  <ProfileFieldIcon kind="phone" />
                </div>
                <div className="profile-detail-content">
                  <span className="muted">Số điện thoại</span>
                  {isEditing ? (
                    <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Số điện thoại" />
                  ) : (
                    <strong>{phone || '-'}</strong>
                  )}
                </div>
              </div>

              <div className="profile-detail-row">
                <div className="profile-detail-icon">
                  <ProfileFieldIcon kind="city" />
                </div>
                <div className="profile-detail-content">
                  <span className="muted">Thành phố</span>
                  {isEditing ? (
                    <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Thành phố" />
                  ) : (
                    <strong>{city || '-'}</strong>
                  )}
                </div>
              </div>

              <div className="profile-detail-row">
                <div className="profile-detail-icon">
                  <ProfileFieldIcon kind="address" />
                </div>
                <div className="profile-detail-content">
                  <span className="muted">Địa chỉ</span>
                  {isEditing ? (
                    <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Địa chỉ" />
                  ) : (
                    <strong>{address || '-'}</strong>
                  )}
                </div>
              </div>

              <div className="profile-detail-row">
                <div className="profile-detail-icon">
                  <ProfileFieldIcon kind="role" />
                </div>
                <div className="profile-detail-content">
                  <span className="muted">Vai trò</span>
                  <strong>{roleLabel(user.role)}</strong>
                </div>
              </div>
            </div>

            {isEditing ? (
              <button
                className="primary-button"
                onClick={async () => {
                  await state.updateProfile({ fullName, phone, city, address })
                  setIsEditing(false)
                }}
                type="button"
              >
                Lưu thông tin
              </button>
            ) : null}
          </Card>

          <button className="danger-button profile-signout-button" onClick={() => void state.logout()} type="button">
            <span className="profile-inline-icon">
              <ProfileFieldIcon kind="logout" />
            </span>
            Đăng xuất
          </button>
        </div>
      }
    />
  )
}

function profileBackPage(role: UserRole) {
  switch (role) {
    case UserRole.renter:
      return AppPage.renterHome
    case UserRole.owner:
      return AppPage.ownerDashboard
    case UserRole.admin:
      return AppPage.adminDashboard
  }
}

function roleLabel(role: UserRole) {
  switch (role) {
    case UserRole.renter:
      return 'Người thuê'
    case UserRole.owner:
      return 'Chủ xe'
    case UserRole.admin:
      return 'Quản trị viên'
  }
}
