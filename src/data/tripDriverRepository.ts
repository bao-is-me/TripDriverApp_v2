import type {
  Booking,
  BookingDraft,
  BookingStatusHistory,
  Car,
  CarImage,
  CarReview,
  CarStatus,
  CreateCarInput,
  NotificationItem,
  Payment,
  Profile,
  UserRole,
} from '../domain/models'

export class TripDriverRepositoryException extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TripDriverRepositoryException'
  }
}

export interface TripDriverSnapshot {
  profiles: Profile[]
  cars: Car[]
  carImages: CarImage[]
  bookings: Booking[]
  payments: Payment[]
  reviews: CarReview[]
  notifications: NotificationItem[]
  bookingStatusHistory: BookingStatusHistory[]
}

export interface RegisterResult {
  profile: Profile | null
  requiresEmailConfirmation: boolean
}

export interface TripDriverRepository {
  restoreSessionProfile(): Promise<Profile | null>
  signIn(input: { email: string; password: string }): Promise<Profile>
  register(input: {
    fullName: string
    email: string
    phone: string
    password: string
    role: UserRole
  }): Promise<RegisterResult>
  signOut(): Promise<void>
  loadSnapshot(profile: Profile): Promise<TripDriverSnapshot>
  expireStaleBookings(): Promise<void>
  createBookingDraft(input: {
    actor: Profile
    carId: string
    startDate: Date
    endDate: Date
    pickupNote: string
    ownerNote: string
  }): Promise<BookingDraft>
  submitDeposit(input: { actor: Profile; bookingId: string }): Promise<void>
  cancelBooking(input: { actor: Profile; bookingId: string }): Promise<void>
  adminApproveDeposit(input: {
    actor: Profile
    bookingId: string
  }): Promise<void>
  adminRejectDeposit(input: {
    actor: Profile
    bookingId: string
  }): Promise<void>
  ownerConfirmBooking(input: {
    actor: Profile
    bookingId: string
  }): Promise<void>
  ownerRejectBooking(input: {
    actor: Profile
    bookingId: string
  }): Promise<void>
  renterMarkReceivedCar(input: {
    actor: Profile
    bookingId: string
  }): Promise<void>
  renterMarkReturnedCar(input: {
    actor: Profile
    bookingId: string
  }): Promise<void>
  ownerCompleteTrip(input: {
    actor: Profile
    bookingId: string
  }): Promise<void>
  submitReview(input: {
    actor: Profile
    bookingId: string
    rating: number
    comment: string
  }): Promise<void>
  updateProfile(input: {
    actor: Profile
    fullName: string
    phone: string
    city: string
    address: string
  }): Promise<Profile>
  toggleCarVisibility(input: {
    actor: Profile
    carId: string
    nextStatus: CarStatus
  }): Promise<void>
  createCar(input: { actor: Profile; input: CreateCarInput }): Promise<void>
}
