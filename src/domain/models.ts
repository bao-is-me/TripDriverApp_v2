export enum UserRole {
  renter = 'renter',
  owner = 'owner',
  admin = 'admin',
}

export enum CarStatus {
  active = 'active',
  held = 'held',
  rented = 'rented',
  deactive = 'deactive',
}

export enum BookingStatus {
  pendingDeposit = 'pendingDeposit',
  pendingAdminPaymentReview = 'pendingAdminPaymentReview',
  pendingOwnerConfirmation = 'pendingOwnerConfirmation',
  confirmed = 'confirmed',
  inProgress = 'inProgress',
  pendingOwnerCompletion = 'pendingOwnerCompletion',
  completed = 'completed',
  rejectedByOwner = 'rejectedByOwner',
  cancelled = 'cancelled',
  expired = 'expired',
}

export enum PaymentStatus {
  pending = 'pending',
  paid = 'paid',
  failed = 'failed',
  refunded = 'refunded',
}

export enum NotificationType {
  info = 'info',
  success = 'success',
  warning = 'warning',
}

export const UserRoleDb = {
  [UserRole.renter]: 'RENTER',
  [UserRole.owner]: 'OWNER',
  [UserRole.admin]: 'ADMIN',
} as const

export const CarStatusDb = {
  [CarStatus.active]: 'ACTIVE',
  [CarStatus.held]: 'HELD',
  [CarStatus.rented]: 'RENTED',
  [CarStatus.deactive]: 'DEACTIVE',
} as const

export const BookingStatusDb = {
  [BookingStatus.pendingDeposit]: 'PENDING_DEPOSIT',
  [BookingStatus.pendingAdminPaymentReview]: 'PENDING_ADMIN_PAYMENT_REVIEW',
  [BookingStatus.pendingOwnerConfirmation]: 'PENDING_OWNER_CONFIRMATION',
  [BookingStatus.confirmed]: 'CONFIRMED',
  [BookingStatus.inProgress]: 'IN_PROGRESS',
  [BookingStatus.pendingOwnerCompletion]: 'PENDING_OWNER_COMPLETION',
  [BookingStatus.completed]: 'COMPLETED',
  [BookingStatus.rejectedByOwner]: 'REJECTED_BY_OWNER',
  [BookingStatus.cancelled]: 'CANCELLED',
  [BookingStatus.expired]: 'EXPIRED',
} as const

export const PaymentStatusDb = {
  [PaymentStatus.pending]: 'PENDING',
  [PaymentStatus.paid]: 'PAID',
  [PaymentStatus.failed]: 'FAILED',
  [PaymentStatus.refunded]: 'REFUNDED',
} as const

export const NotificationTypeDb = {
  [NotificationType.info]: 'INFO',
  [NotificationType.success]: 'SUCCESS',
  [NotificationType.warning]: 'WARNING',
} as const

export function userRoleFromDb(value?: string | null): UserRole {
  switch ((value ?? '').toUpperCase()) {
    case 'OWNER':
      return UserRole.owner
    case 'ADMIN':
      return UserRole.admin
    case 'RENTER':
    default:
      return UserRole.renter
  }
}

export function carStatusFromDb(value?: string | null): CarStatus {
  switch ((value ?? '').toUpperCase()) {
    case 'ACTIVE':
      return CarStatus.active
    case 'HELD':
      return CarStatus.held
    case 'RENTED':
      return CarStatus.rented
    case 'DEACTIVE':
    case 'DRAFT':
    default:
      return CarStatus.deactive
  }
}

export function bookingStatusFromDb(value?: string | null): BookingStatus {
  switch ((value ?? '').toUpperCase()) {
    case 'PENDING_ADMIN_PAYMENT_REVIEW':
      return BookingStatus.pendingAdminPaymentReview
    case 'PENDING_OWNER_CONFIRMATION':
      return BookingStatus.pendingOwnerConfirmation
    case 'CONFIRMED':
      return BookingStatus.confirmed
    case 'IN_PROGRESS':
      return BookingStatus.inProgress
    case 'PENDING_OWNER_COMPLETION':
      return BookingStatus.pendingOwnerCompletion
    case 'COMPLETED':
      return BookingStatus.completed
    case 'REJECTED_BY_OWNER':
      return BookingStatus.rejectedByOwner
    case 'CANCELLED':
      return BookingStatus.cancelled
    case 'EXPIRED':
      return BookingStatus.expired
    case 'PENDING_DEPOSIT':
    default:
      return BookingStatus.pendingDeposit
  }
}

export function paymentStatusFromDb(value?: string | null): PaymentStatus {
  switch ((value ?? '').toUpperCase()) {
    case 'PAID':
      return PaymentStatus.paid
    case 'FAILED':
      return PaymentStatus.failed
    case 'REFUNDED':
      return PaymentStatus.refunded
    case 'PENDING':
    default:
      return PaymentStatus.pending
  }
}

export function notificationTypeFromDb(
  value?: string | null,
): NotificationType {
  switch ((value ?? '').toUpperCase()) {
    case 'SUCCESS':
      return NotificationType.success
    case 'WARNING':
      return NotificationType.warning
    case 'INFO':
    default:
      return NotificationType.info
  }
}

export interface Profile {
  id: string
  email: string
  fullName: string
  phone: string
  city: string
  address: string
  avatarUrl: string
  role: UserRole
  isActive: boolean
}

export function placeholderProfile(id: string): Profile {
  return {
    id,
    email: '',
    fullName: 'Liên hệ bị ẩn',
    phone: '',
    city: '',
    address: '',
    avatarUrl: '',
    role: UserRole.renter,
    isActive: true,
  }
}

export interface Car {
  id: string
  ownerId: string
  name: string
  brand: string
  model: string
  year: number
  location: string
  seats: number
  transmission: string
  fuel: string
  pricePerDay: number
  depositPercent: number
  description: string
  status: CarStatus
  primaryImage: string
}

export interface CarImage {
  id: string
  carId: string
  imageUrl: string
  sortOrder: number
}

export interface Payment {
  id: string
  bookingId: string
  amount: number
  transferContent: string
  status: PaymentStatus
  createdAt: string
  method: string
  type: string
  markedPaidAt?: string | null
  verifiedAt?: string | null
}

export interface Booking {
  id: string
  code: string
  carId: string
  customerId: string
  ownerId: string
  startDate: string
  endDate: string
  pickupNote: string
  ownerNote: string
  totalAmount: number
  depositAmount: number
  remainingAmount: number
  platformFeeAmount: number
  ownerPayoutAmount: number
  status: BookingStatus
  createdAt: string
  holdExpiresAt?: string | null
}

export interface CarReview {
  id: string
  bookingId: string
  carId: string
  customerId: string
  customerName: string
  rating: number
  comment: string
  createdAt: string
}

export interface NotificationItem {
  id: string
  userId: string
  title: string
  message: string
  type: NotificationType
  createdAt: string
}

export interface BookingStatusHistory {
  id: string
  bookingId: string
  fromStatus?: BookingStatus | null
  toStatus: BookingStatus
  note: string
  changedByUserId: string
  createdAt: string
}

export interface BookingDraft {
  bookingId: string
  paymentId: string
}

export interface CreateCarInput {
  brand: string
  model: string
  year: number
  location: string
  seats: number
  transmission: string
  fuel: string
  pricePerDay: number
  description: string
  imageUrl: string
  activeNow: boolean
}

export function bookingDays(booking: Booking): number {
  const start = new Date(booking.startDate)
  const end = new Date(booking.endDate)
  const days = Math.floor((end.getTime() - start.getTime()) / 86400000)
  return Math.max(1, days)
}

export function effectiveHoldExpiresAt(booking: Booking): string {
  if (booking.holdExpiresAt) {
    return booking.holdExpiresAt
  }
  return new Date(
    new Date(booking.createdAt).getTime() + 60 * 60 * 1000,
  ).toISOString()
}

