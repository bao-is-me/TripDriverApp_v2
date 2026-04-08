import { useState } from 'react'

import { UserRole, effectiveHoldExpiresAt } from '../domain/models'
import { useTripDriver } from '../state/TripDriverContext'
import {
  AdminBottomNav,
  BookingCard,
  Card,
  CarCard,
  KeyValueRow,
  RoleScaffold,
  StatCard,
  dateTimeLabel,
  money,
} from './shared'

export function AdminDashboardPage() {
  const state = useTripDriver()
  const users = state.profiles
  const owners = users.filter((user) => user.role === UserRole.owner).length
  const renters = users.filter((user) => user.role === UserRole.renter).length
  const bookings = state.bookingsForCurrentUser()

  return (
    <RoleScaffold
      title="Bảng điều khiển admin"
      subtitle="Theo dõi nhanh hoạt động vận hành của nền tảng"
      bottomNav={<AdminBottomNav />}
      body={
        <div className="page-stack">
          <div className="stats-grid">
            <StatCard label="Tài khoản" value={`${users.length}`} color="#1565C0" />
            <StatCard label="Chủ xe" value={`${owners}`} color="#6A1B9A" />
            <StatCard label="Người thuê" value={`${renters}`} color="#2E7D32" />
            <StatCard label="Số xe" value={`${state.cars.length}`} color="#EF6C00" />
          </div>
          <Card>
            <h3>Chỉ số doanh thu nền tảng</h3>
            <KeyValueRow label="Tổng số đơn" value={`${bookings.length}`} />
            <KeyValueRow label="Tổng cọc đã thu" value={money(state.adminTotalDepositCollected())} />
            <KeyValueRow label="Tổng phí nền tảng" value={money(state.adminTotalPlatformFee())} />
            <KeyValueRow label="Tổng thực nhận của chủ xe" value={money(state.adminTotalOwnerPayout())} />
            <KeyValueRow label="Đơn chờ duyệt cọc" value={`${state.adminPendingDepositBookings().length}`} />
          </Card>
          <h3>Đơn gần đây</h3>
          {bookings.slice(0, 5).map((booking) => {
            const car = state.carById(booking.carId)
            return (
              <BookingCard
                key={booking.id}
                booking={booking}
                car={car}
                statusLabel={state.bookingStatusLabel(booking.status)}
                ownerLabel={`Người thuê: ${state.profileById(booking.customerId).fullName}`}
              />
            )
          })}
        </div>
      }
    />
  )
}

export function AdminPendingPaymentsPage() {
  const state = useTripDriver()
  const pending = state.adminPendingDepositBookings()

  return (
    <RoleScaffold
      title="Đơn chờ duyệt cọc"
      subtitle="Luồng quan trọng: admin kiểm tra chuyển khoản thủ công"
      bottomNav={<AdminBottomNav />}
      headerAction={
        <button className="secondary-button" onClick={() => void state.refreshData()} type="button">
          Làm mới
        </button>
      }
      body={
        <div className="page-stack">
          {pending.map((booking) => {
            const payment = state.paymentForBooking(booking.id)
            const renter = state.profileById(booking.customerId)
            const car = state.carById(booking.carId)

            if (!payment) {
              return null
            }

            return (
              <Card key={booking.id}>
                <h3>
                  {booking.code} | {car.name}
                </h3>
                <KeyValueRow label="Người thuê" value={renter.fullName} />
                <KeyValueRow label="Tiền cọc" value={money(payment.amount)} />
                <KeyValueRow label="Nội dung chuyển khoản" value={payment.transferContent || '-'} />
                <KeyValueRow
                  label="Thời điểm báo đã chuyển"
                  value={payment.markedPaidAt ? dateTimeLabel(payment.markedPaidAt) : '-'}
                />
                <KeyValueRow label="Giữ chỗ đến" value={dateTimeLabel(effectiveHoldExpiresAt(booking))} />
                <div className="split-row">
                  <button className="primary-button success-button" onClick={() => void state.adminApproveDeposit(booking.id)} type="button">
                    Xác nhận cọc
                  </button>
                  <button className="danger-button" onClick={() => void state.adminMarkPaymentFailed(booking.id)} type="button">
                    Từ chối
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      }
    />
  )
}

export function AdminRecentBookingsPage() {
  const state = useTripDriver()
  const bookings = state.bookingsForCurrentUser()

  return (
    <RoleScaffold
      title="Danh sách đơn thuê"
      subtitle="Theo dõi toàn bộ đơn theo từng trạng thái"
      bottomNav={<AdminBottomNav />}
      body={
        <div className="page-stack">
          {bookings.map((booking) => {
            const car = state.carById(booking.carId)
            const renter = state.profileById(booking.customerId)
            const owner = state.profileById(booking.ownerId)
            return (
              <BookingCard
                key={booking.id}
                booking={booking}
                car={car}
                statusLabel={state.bookingStatusLabel(booking.status)}
                ownerLabel={
                  <span className="booking-party-info">
                    <span>Người thuê: {renter.fullName}</span>
                    <span>Chủ xe: {owner.fullName}</span>
                  </span>
                }
              />
            )
          })}
        </div>
      }
    />
  )
}

export function AdminUsersPage() {
  const state = useTripDriver()
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all')
  const users = state.profiles.filter((user) =>
    roleFilter === 'all' ? true : user.role === roleFilter,
  )

  return (
    <RoleScaffold
      title="Tài khoản người dùng"
      subtitle="Danh sách hồ sơ hiện có trên hệ thống"
      bottomNav={<AdminBottomNav />}
      body={
        <div className="page-stack">
          <div className="chip-row">
            <button className={`chip ${roleFilter === 'all' ? 'active' : ''}`} onClick={() => setRoleFilter('all')} type="button">
              Tất cả
            </button>
            <button className={`chip ${roleFilter === UserRole.renter ? 'active' : ''}`} onClick={() => setRoleFilter(UserRole.renter)} type="button">
              Người thuê
            </button>
            <button className={`chip ${roleFilter === UserRole.owner ? 'active' : ''}`} onClick={() => setRoleFilter(UserRole.owner)} type="button">
              Chủ xe
            </button>
            <button className={`chip ${roleFilter === UserRole.admin ? 'active' : ''}`} onClick={() => setRoleFilter(UserRole.admin)} type="button">
              Admin
            </button>
          </div>
          {users.map((user) => (
            <Card key={user.id}>
              <h3>{user.fullName}</h3>
              <p>{user.email}</p>
              <p>{user.phone}</p>
              <p>{user.city}</p>
              <div className="inline-row">
                <strong>{user.role.toUpperCase()}</strong>
                <span className="muted">{user.isActive ? 'Đang hoạt động' : 'Ngưng hoạt động'}</span>
              </div>
            </Card>
          ))}
        </div>
      }
    />
  )
}

export function AdminCarsPage() {
  const state = useTripDriver()

  return (
    <RoleScaffold
      title="Toàn bộ xe"
      subtitle="Theo dõi trạng thái xe và chủ sở hữu"
      bottomNav={<AdminBottomNav />}
      body={
        <div className="page-stack">
          {state.cars.map((car) => {
            const owner = state.profileById(car.ownerId)
            return (
              <Card key={car.id}>
                <CarCard car={car} rating={state.averageRatingForCar(car.id)} />
                <KeyValueRow label="Chủ xe" value={owner.fullName} />
                <KeyValueRow label="Trạng thái" value={state.carStatusLabel(car.status)} />
              </Card>
            )
          })}
        </div>
      }
    />
  )
}

export function AdminRevenuePage() {
  const state = useTripDriver()
  const bookings = state.bookingsForCurrentUser()

  return (
    <RoleScaffold
      title="Báo cáo doanh thu"
      subtitle="Theo dõi tiền cọc, phí nền tảng và thực nhận của chủ xe"
      bottomNav={<AdminBottomNav />}
      body={
        <div className="page-stack">
          <StatCard label="Tổng cọc đã thu" value={money(state.adminTotalDepositCollected())} color="#1565C0" />
          <StatCard label="Tổng phí nền tảng" value={money(state.adminTotalPlatformFee())} color="#2E7D32" />
          <StatCard label="Tổng thực nhận chủ xe" value={money(state.adminTotalOwnerPayout())} color="#6A1B9A" />
          <h3>Đơn và các trường tiền</h3>
          {bookings.map((booking) => {
            const car = state.carById(booking.carId)
            return (
              <Card key={booking.id}>
                <h3>
                  {booking.code} | {car.name}
                </h3>
                <div className="revenue-breakdown">
                  <KeyValueRow label="Tổng tiền" value={money(booking.totalAmount)} />
                  <KeyValueRow label="Phí nền tảng" value={money(booking.platformFeeAmount)} />
                  <KeyValueRow label="Chủ xe thực nhận" value={money(booking.ownerPayoutAmount)} />
                </div>
              </Card>
            )
          })}
        </div>
      }
    />
  )
}

