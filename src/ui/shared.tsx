import { useEffect, useState, type ReactNode } from 'react'

import { AppPage } from '../app/appPage'
import { AppAssets } from '../core/appAssets'
import {
  BookingStatus,
  CarStatus,
  NotificationType,
  type Booking,
  type Car,
  type NotificationItem,
} from '../domain/models'
import { useTripDriver } from '../state/TripDriverContext'

export function money(value: number) {
  return `${value.toLocaleString('vi-VN')} VNĐ`
}

export function dateLabel(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${date.getFullYear()}`
}

export function dateTimeLabel(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${dateLabel(date)} ${hours}:${minutes}`
}

export function statusColor(status: BookingStatus) {
  switch (status) {
    case BookingStatus.pendingDeposit:
    case BookingStatus.pendingAdminPaymentReview:
    case BookingStatus.pendingOwnerConfirmation:
      return '#EF6C00'
    case BookingStatus.confirmed:
    case BookingStatus.inProgress:
    case BookingStatus.pendingOwnerCompletion:
      return '#1565C0'
    case BookingStatus.completed:
      return '#2E7D32'
    case BookingStatus.rejectedByOwner:
    case BookingStatus.cancelled:
    case BookingStatus.expired:
      return '#C62828'
  }
}

export function carStatusColor(status: CarStatus) {
  switch (status) {
    case CarStatus.active:
      return '#2E7D32'
    case CarStatus.held:
      return '#EF6C00'
    case CarStatus.rented:
      return '#1565C0'
    case CarStatus.deactive:
      return '#6B7280'
  }
}

export function AppFrame({ children }: { children: ReactNode }) {
  const state = useTripDriver()
  const [toastVisible, setToastVisible] = useState(false)

  useEffect(() => {
    if (!state.message.text) {
      return
    }
    setToastVisible(true)
    const timer = window.setTimeout(() => {
      setToastVisible(false)
      state.clearMessage()
    }, 3200)
    return () => window.clearTimeout(timer)
  }, [state, state.message.text])

  if (state.isBootstrapping) {
    return <LoadingView />
  }

  return (
    <div className="app-frame">
      {children}
      {state.isWorking ? <div className="linear-loader" /> : null}
      {toastVisible && state.message.text ? (
        <div className={`toast toast-${state.message.type ?? NotificationType.info}`}>
          {state.message.text}
        </div>
      ) : null}
    </div>
  )
}

export function RoleScaffold(props: {
  title: string
  subtitle: string
  body: ReactNode
  onBack?: () => void
  bottomNav?: ReactNode
  floatingAction?: ReactNode
  notifications?: NotificationItem[]
  headerAction?: ReactNode
}) {
  return (
    <div className="role-scaffold">
      <header className="page-header">
        <div className="page-header-row">
          {props.onBack ? (
            <button className="icon-button" onClick={props.onBack} type="button">
              {'<'}
            </button>
          ) : (
            <div className="logo-badge">
              <img alt="TripDriver" src={AppAssets.tripDriverLogo} />
            </div>
          )}
          <div className="page-heading">
            <h1>{props.title}</h1>
            {props.subtitle ? <p>{props.subtitle}</p> : null}
          </div>
          {props.headerAction ? (
            <div className="page-header-action">{props.headerAction}</div>
          ) : null}
        </div>
      </header>

      {props.notifications?.length ? (
        <div className="notification-banner">
          {props.notifications[0].title}: {props.notifications[0].message}
        </div>
      ) : null}

      <main className="page-body">{props.body}</main>
      {props.floatingAction ? <div className="floating-action">{props.floatingAction}</div> : null}
      {props.bottomNav ? <div className="bottom-nav-slot">{props.bottomNav}</div> : null}
    </div>
  )
}

export function LoadingView() {
  return (
    <div className="loading-screen">
      <div className="loading-card">
        <img alt="TripDriver" className="loading-logo" src={AppAssets.tripDriverLogo} />
        <h1>TripDriver</h1>
        <div className="loading-bar">
          <span />
        </div>
      </div>
    </div>
  )
}

export function StatusBadge(props: { label: string; color: string }) {
  return (
    <span
      className="status-badge"
      style={{
        color: props.color,
        backgroundColor: `${props.color}1f`,
      }}
    >
      {props.label}
    </span>
  )
}

export function KeyValueRow(props: { label: string; value: string }) {
  return (
    <div className="key-value-row">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  )
}

export function Card(props: { children: ReactNode; className?: string }) {
  return <section className={`card ${props.className ?? ''}`.trim()}>{props.children}</section>
}

export function CarCard(props: {
  car: Car
  rating: number
  onClick?: () => void
  variant?: 'compact' | 'large'
  badgeLabel?: string
}) {
  const isLarge = props.variant === 'large'
  return (
    <button className={`card car-card ${isLarge ? 'car-card-large' : ''}`.trim()} type="button" onClick={props.onClick}>
      <div className={`car-card-image-wrap ${isLarge ? 'car-card-image-wrap-large' : ''}`.trim()}>
        {props.badgeLabel ? <span className="car-card-badge">{props.badgeLabel}</span> : null}
        {props.car.primaryImage ? (
          <img className="car-card-image" alt={props.car.name} src={props.car.primaryImage} />
        ) : (
          <div className="image-fallback">Chưa có ảnh</div>
        )}
      </div>
      <div className="car-card-content">
        <strong>{props.car.name}</strong>
        <span className="muted">{props.car.location}</span>
        <span>
          {props.car.seats} chỗ | {props.car.transmission} | {props.car.fuel}
        </span>
        <div className="car-card-meta">
          <strong className="price-text">{money(props.car.pricePerDay)}</strong>
          <span className="car-card-rating">{props.rating === 0 ? "" : `★ ${props.rating.toFixed(1)}`}</span>
        </div>
      </div>
    </button>
  )
}

export function BookingCard(props: {
  booking: Booking
  car: Car
  statusLabel: string
  ownerLabel: string
  onClick?: () => void
}) {
  return (
    <button className="card booking-card" type="button" onClick={props.onClick}>
      <div className="booking-card-header">
        <strong>
          {props.booking.code} | {props.car.name}
        </strong>
        <StatusBadge label={props.statusLabel} color={statusColor(props.booking.status)} />
      </div>
      <KeyValueRow
        label="Ngày thuê"
        value={`${dateLabel(props.booking.startDate)} - ${dateLabel(props.booking.endDate)}`}
      />
      <KeyValueRow label="Tổng tiền" value={money(props.booking.totalAmount)} />
      <KeyValueRow
        label="Cọc / Còn lại"
        value={`${money(props.booking.depositAmount)} / ${money(props.booking.remainingAmount)}`}
      />
      <KeyValueRow label="Thông tin" value={props.ownerLabel} />
    </button>
  )
}

export function HeroImage(props: { imageUrl: string; height?: number }) {
  return props.imageUrl ? (
    <div className="hero-image" style={{ height: props.height ?? 220 }}>
      <img alt="" src={props.imageUrl} />
    </div>
  ) : (
    <div className="hero-image image-fallback" style={{ height: props.height ?? 220 }}>
      Chưa có ảnh
    </div>
  )
}

export function StatCard(props: {
  label: string
  value: string
  color: string
  className?: string
}) {
  return (
    <Card className={`stat-card ${props.className ?? ''}`.trim()}>
      <span className="muted">{props.label}</span>
      <strong style={{ color: props.color }}>{props.value}</strong>
    </Card>
  )
}

export function RenterBottomNav() {
  const state = useTripDriver()
  const current = state.page === AppPage.renterTrips ? 1 : state.page === AppPage.profile ? 2 : 0

  return (
    <nav className="bottom-nav">
      <button className={current === 0 ? 'active' : ''} onClick={() => state.goTo(AppPage.renterHome)} type="button">
        Trang chủ
      </button>
      <button className={current === 1 ? 'active' : ''} onClick={() => state.goTo(AppPage.renterTrips)} type="button">
        Chuyến đi
      </button>
      <button className={current === 2 ? 'active' : ''} onClick={() => state.goTo(AppPage.profile)} type="button">
        Tài khoản
      </button>
    </nav>
  )
}

export function OwnerBottomNav() {
  const state = useTripDriver()
  const current =
    state.page === AppPage.ownerCars
      ? 1
      : state.page === AppPage.ownerCreateCar
        ? 2
        : state.page === AppPage.ownerBookings
          ? 3
          : state.page === AppPage.profile
            ? 4
            : 0

  return (
    <nav className="bottom-nav bottom-nav-owner">
      <button className={current === 0 ? 'active' : ''} onClick={() => state.goTo(AppPage.ownerDashboard)} type="button">
        Tổng quan
      </button>
      <button className={current === 1 ? 'active' : ''} onClick={() => state.goTo(AppPage.ownerCars)} type="button">
        Xe
      </button>
      <button className={current === 2 ? 'active' : ''} onClick={() => state.goTo(AppPage.ownerCreateCar)} type="button">
        Tạo xe
      </button>
      <button className={current === 3 ? 'active' : ''} onClick={() => state.goTo(AppPage.ownerBookings)} type="button">
        Đơn thuê
      </button>
      <button className={current === 4 ? 'active' : ''} onClick={() => state.goTo(AppPage.profile)} type="button">
        Tài khoản
      </button>
    </nav>
  )
}

export function AdminBottomNav() {
  const state = useTripDriver()
  const current =
    state.page === AppPage.adminPendingPayments
      ? 1
      : state.page === AppPage.adminRecentBookings
        ? 2
        : state.page === AppPage.adminUsers
          ? 3
          : state.page === AppPage.adminCars
            ? 4
            : state.page === AppPage.adminRevenue
              ? 5
              : state.page === AppPage.profile
                ? 6
                : 0

  return (
    <nav className="bottom-nav bottom-nav-admin">
      <button className={current === 0 ? 'active' : ''} onClick={() => state.goTo(AppPage.adminDashboard)} type="button">
        Tổng quan
      </button>
      <button className={current === 1 ? 'active' : ''} onClick={() => state.goTo(AppPage.adminPendingPayments)} type="button">
        Duyệt cọc
      </button>
      <button className={current === 2 ? 'active' : ''} onClick={() => state.goTo(AppPage.adminRecentBookings)} type="button">
        Đơn thuê
      </button>
      <button className={current === 3 ? 'active' : ''} onClick={() => state.goTo(AppPage.adminUsers)} type="button">
        Người dùng
      </button>
      <button className={current === 4 ? 'active' : ''} onClick={() => state.goTo(AppPage.adminCars)} type="button">
        Xe
      </button>
      <button className={current === 5 ? 'active' : ''} onClick={() => state.goTo(AppPage.adminRevenue)} type="button">
        Doanh thu
      </button>
      <button className={current === 6 ? 'active' : ''} onClick={() => state.goTo(AppPage.profile)} type="button">
        Tài khoản
      </button>
    </nav>
  )
}
