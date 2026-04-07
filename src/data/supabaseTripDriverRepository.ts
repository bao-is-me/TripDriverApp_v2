import { PaymentConfig } from '../core/paymentConfig'
import { supabase } from '../core/supabase/supabaseClient'
import {
  BookingStatus,
  BookingStatusDb,
  CarStatus,
  CarStatusDb,
  NotificationType,
  NotificationTypeDb,
  PaymentStatus,
  PaymentStatusDb,
  UserRole,
  UserRoleDb,
  bookingStatusFromDb,
  carStatusFromDb,
  notificationTypeFromDb,
  paymentStatusFromDb,
  userRoleFromDb,
  type Booking,
  type BookingDraft,
  type BookingStatusHistory,
  type Car,
  type CarImage,
  type CarReview,
  type CreateCarInput,
  type NotificationItem,
  type Payment,
  type Profile,
} from '../domain/models'
import {
  TripDriverRepositoryException,
  type RegisterResult,
  type TripDriverRepository,
  type TripDriverSnapshot,
} from './tripDriverRepository'

type DbRow = Record<string, unknown>

export class SupabaseTripDriverRepository implements TripDriverRepository {
  async restoreSessionProfile(): Promise<Profile | null> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return null
    }
    return this.ensureProfileForAuthUser(user)
  }

  async signIn(input: {
    email: string
    password: string
  }): Promise<Profile> {
    const { error } = await supabase.auth.signInWithPassword({
      email: input.email.trim(),
      password: input.password.trim(),
    })
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      throw new TripDriverRepositoryException(
        'Đăng nhập thành công nhưng không tìm thấy phiên làm việc đang hoạt động.',
      )
    }
    const profile = await this.ensureProfileForAuthUser(user)
    if (!profile) {
      throw new TripDriverRepositoryException(
        'Không tìm thấy hồ sơ người dùng cho tài khoản này.',
      )
    }
    return profile
  }

  async register(input: {
    fullName: string
    email: string
    phone: string
    password: string
    role: UserRole
  }): Promise<RegisterResult> {
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password.trim(),
      options: {
        data: {
          full_name: input.fullName.trim(),
          phone: input.phone.trim(),
          app_role: UserRoleDb[input.role],
        },
      },
    })
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    const user = data.user
    if (!user) {
      throw new TripDriverRepositoryException(
        'Supabase không trả về tài khoản người dùng sau khi đăng ký.',
      )
    }
    const requiresEmailConfirmation = !data.session
    if (requiresEmailConfirmation) {
      return {
        profile: null,
        requiresEmailConfirmation: true,
      }
    }

    const profile = await this.upsertProfileForUser(user, {
      fullName: input.fullName.trim(),
      phone: input.phone.trim(),
      role: input.role,
    })
    if (!profile) {
      throw new TripDriverRepositoryException(
        'Không thể tạo hồ sơ người dùng sau khi đăng ký.',
      )
    }
    return {
      profile,
      requiresEmailConfirmation: false,
    }
  }

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
  }

  async expireStaleBookings(): Promise<void> {
    const { error } = await supabase.rpc('app_expire_stale_bookings')
    if (!error) {
      return
    }
    if (this.isMissingTripDriverSchemaError(error.message)) {
      throw new TripDriverRepositoryException(
        this.normalizeDatabaseError(error.message),
      )
    }
    await this.expireStaleBookingsFallback()
  }

  async reconcileCarStatuses(): Promise<void> {
    const { error } = await supabase.rpc('app_reconcile_car_statuses')
    if (!error) {
      return
    }
    if (
      error.message.includes(
        'Could not find the function public.app_reconcile_car_statuses',
      ) ||
      error.message.includes('function public.app_reconcile_car_statuses')
    ) {
      return
    }
    throw new TripDriverRepositoryException(
      this.normalizeDatabaseError(error.message),
    )
  }

  async loadSnapshot(profile: Profile): Promise<TripDriverSnapshot> {
    await this.expireStaleBookings()
    await this.reconcileCarStatuses()

    switch (profile.role) {
      case UserRole.renter:
        return this.loadRenterSnapshot(profile)
      case UserRole.owner:
        return this.loadOwnerSnapshot(profile)
      case UserRole.admin:
        return this.loadAdminSnapshot(profile)
    }
  }

  async createBookingDraft(input: {
    actor: Profile
    carId: string
    startDate: Date
    endDate: Date
    pickupNote: string
    ownerNote: string
  }): Promise<BookingDraft> {
    this.requireRole(input.actor, UserRole.renter)
    await this.expireStaleBookings()
    await this.reconcileCarStatuses()
    const { data, error } = await supabase.rpc('app_create_booking_with_hold', {
      p_car_id: input.carId,
      p_start_date: this.isoDate(input.startDate),
      p_end_date: this.isoDate(input.endDate),
      p_pickup_note: input.pickupNote.trim(),
      p_customer_note: input.ownerNote.trim(),
    })
    if (error) {
      throw new TripDriverRepositoryException(
        this.normalizeDatabaseError(error.message),
      )
    }
    if (!data || typeof data !== 'object') {
      throw new TripDriverRepositoryException(
        'Tạo booking không trả về dữ liệu như mong đợi.',
      )
    }
    const record = data as Record<string, string>
    return {
      bookingId: record.booking_id,
      paymentId: record.payment_id,
    }
  }

  async submitDeposit(input: {
    actor: Profile
    bookingId: string
  }): Promise<void> {
    this.requireRole(input.actor, UserRole.renter)
    await this.expireStaleBookings()

    const booking = await this.fetchBooking(input.bookingId)
    if (!booking || booking.customerId !== input.actor.id) {
      throw new TripDriverRepositoryException(
        'Bạn chỉ có thể gửi xác nhận thanh toán cho đơn của chính mình.',
      )
    }
    if (booking.status !== BookingStatus.pendingDeposit) {
      throw new TripDriverRepositoryException(
        'Đơn này không còn ở trạng thái chờ nộp cọc.',
      )
    }

    const payment = await this.fetchPaymentForBooking(input.bookingId)
    if (!payment) {
      throw new TripDriverRepositoryException(
        'Không tìm thấy bản ghi thanh toán cho đơn này.',
      )
    }

    await this.assert(
      supabase
        .from('bookings')
        .update({
          status: BookingStatusDb[BookingStatus.pendingAdminPaymentReview],
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.bookingId),
    )

    await this.assert(
      supabase
        .from('payments')
        .update({
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id),
    )

    await this.insertHistory({
      bookingId: input.bookingId,
      fromStatus: booking.status,
      toStatus: BookingStatus.pendingAdminPaymentReview,
      note: 'Người thuê đã gửi xác nhận chuyển khoản cọc để admin kiểm tra.',
      changedBy: input.actor.id,
    })

    const adminIds = await this.fetchProfileIdsByRole(UserRole.admin)
    await this.insertNotifications(adminIds, {
      title: 'Cần duyệt cọc',
      message: `Booking ${booking.code} đã được người thuê báo thanh toán và đang chờ admin xác nhận.`,
      type: NotificationType.info,
    })
    await this.insertNotification(input.actor.id, {
      title: 'Đã gửi xác nhận cọc',
      message: `Giao dịch cọc của booking ${booking.code} đang chờ admin kiểm tra.`,
      type: NotificationType.info,
    })
  }

  async cancelBooking(input: {
    actor: Profile
    bookingId: string
  }): Promise<void> {
    await this.expireStaleBookings()
    const booking = await this.fetchBooking(input.bookingId)
    if (!booking) {
      throw new TripDriverRepositoryException('Không tìm thấy booking.')
    }
    if (
      input.actor.role !== UserRole.renter ||
      booking.customerId !== input.actor.id
    ) {
      throw new TripDriverRepositoryException(
        'Chỉ người thuê của booking này mới có thể hủy đơn.',
      )
    }
    const cancellable = new Set<BookingStatus>([
      BookingStatus.pendingDeposit,
      BookingStatus.pendingAdminPaymentReview,
      BookingStatus.pendingOwnerConfirmation,
      BookingStatus.confirmed,
    ])
    if (!cancellable.has(booking.status)) {
      throw new TripDriverRepositoryException(
        'Đơn này không còn có thể hủy trong ứng dụng.',
      )
    }

    await this.assert(
      supabase
        .from('bookings')
        .update({
          status: BookingStatusDb[BookingStatus.cancelled],
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.bookingId),
    )
    await this.syncCarToAvailableIfNoActiveBooking(booking.carId)
    await this.insertHistory({
      bookingId: input.bookingId,
      fromStatus: booking.status,
      toStatus: BookingStatus.cancelled,
      note: 'Booking đã được người thuê hủy.',
      changedBy: input.actor.id,
    })
    await this.insertNotification(booking.ownerId, {
      title: 'Booking đã bị hủy',
      message: `Booking ${booking.code} đã được người thuê hủy.`,
      type: NotificationType.warning,
    })
  }

  async adminApproveDeposit(input: {
    actor: Profile
    bookingId: string
  }): Promise<void> {
    this.requireRole(input.actor, UserRole.admin)
    await this.expireStaleBookings()

    const booking = await this.fetchBooking(input.bookingId)
    const payment = await this.fetchPaymentForBooking(input.bookingId)
    if (!booking || !payment) {
      throw new TripDriverRepositoryException(
        'Không tìm thấy booking hoặc bản ghi thanh toán.',
      )
    }
    if (
      booking.status !== BookingStatus.pendingAdminPaymentReview ||
      payment.status !== PaymentStatus.pending
    ) {
      throw new TripDriverRepositoryException(
        'Booking này không ở trạng thái chờ admin duyệt cọc.',
      )
    }

    await this.assert(
      supabase
        .from('payments')
        .update({
          status: PaymentStatusDb[PaymentStatus.paid],
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id),
    )
    await this.assert(
      supabase
        .from('bookings')
        .update({
          status: BookingStatusDb[BookingStatus.pendingOwnerConfirmation],
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id),
    )
    await this.assert(
      supabase
        .from('cars')
        .update({
          status: CarStatusDb[CarStatus.held],
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.carId),
    )
    await this.insertHistory({
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: BookingStatus.pendingOwnerConfirmation,
      note: 'Admin đã xác nhận khoản cọc của người thuê thành công.',
      changedBy: input.actor.id,
    })
    await this.insertNotification(booking.customerId, {
      title: 'Cọc đã được duyệt',
      message: `Khoản cọc của booking ${booking.code} đã được duyệt. Đang chờ chủ xe xác nhận.`,
      type: NotificationType.success,
    })
    await this.insertNotification(booking.ownerId, {
      title: 'Có đơn chờ xử lý',
      message: `Booking ${booking.code} đã sẵn sàng để bạn xác nhận hoặc từ chối.`,
      type: NotificationType.info,
    })
  }

  async adminRejectDeposit(input: {
    actor: Profile
    bookingId: string
  }): Promise<void> {
    this.requireRole(input.actor, UserRole.admin)
    await this.expireStaleBookings()

    const booking = await this.fetchBooking(input.bookingId)
    const payment = await this.fetchPaymentForBooking(input.bookingId)
    if (!booking || !payment) {
      throw new TripDriverRepositoryException(
        'Không tìm thấy booking hoặc bản ghi thanh toán.',
      )
    }
    if (
      booking.status !== BookingStatus.pendingAdminPaymentReview ||
      payment.status !== PaymentStatus.pending
    ) {
      throw new TripDriverRepositoryException(
        'Khoản thanh toán này không ở trạng thái chờ admin kiểm tra.',
      )
    }

    await this.assert(
      supabase
        .from('payments')
        .update({
          status: PaymentStatusDb[PaymentStatus.failed],
          updated_at: new Date().toISOString(),
        })
        .eq('id', payment.id),
    )
    await this.assert(
      supabase
        .from('bookings')
        .update({
          status: BookingStatusDb[BookingStatus.expired],
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id),
    )
    await this.syncCarToAvailableIfNoActiveBooking(booking.carId)
    await this.insertHistory({
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: BookingStatus.expired,
      note: 'Admin đã từ chối khoản cọc hoặc không thể xác minh giao dịch.',
      changedBy: input.actor.id,
    })
    await this.insertNotification(booking.customerId, {
      title: 'Cá»c bá»‹ tá»« chá»‘i',
      message: `Khoản cọc của booking ${booking.code} không được duyệt. Giữ chỗ đã kết thúc.`,
      type: NotificationType.warning,
    })
  }

  async ownerConfirmBooking(input: {
    actor: Profile
    bookingId: string
  }): Promise<void> {
    this.requireRole(input.actor, UserRole.owner)
    const booking = await this.fetchBooking(input.bookingId)
    if (!booking || booking.ownerId !== input.actor.id) {
      throw new TripDriverRepositoryException(
        'Bạn chỉ có thể xác nhận booking thuộc xe của mình.',
      )
    }
    if (booking.status !== BookingStatus.pendingOwnerConfirmation) {
      throw new TripDriverRepositoryException(
        'Booking này chưa sẵn sàng để chủ xe xác nhận.',
      )
    }
    await this.assert(
      supabase
        .from('bookings')
        .update({
          status: BookingStatusDb[BookingStatus.confirmed],
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id),
    )
    await this.insertHistory({
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: BookingStatus.confirmed,
      note: 'Chủ xe đã chấp nhận booking.',
      changedBy: input.actor.id,
    })
    await this.insertNotification(booking.customerId, {
      title: 'Booking đã được xác nhận',
      message: `Chủ xe đã chấp nhận booking ${booking.code}. Thông tin liên hệ hiện đã có trong chi tiết đơn.`,
      type: NotificationType.success,
    })
  }

  async ownerRejectBooking(input: {
    actor: Profile
    bookingId: string
  }): Promise<void> {
    this.requireRole(input.actor, UserRole.owner)
    const booking = await this.fetchBooking(input.bookingId)
    if (!booking || booking.ownerId !== input.actor.id) {
      throw new TripDriverRepositoryException(
        'Bạn chỉ có thể từ chối booking thuộc xe của mình.',
      )
    }
    if (booking.status !== BookingStatus.pendingOwnerConfirmation) {
      throw new TripDriverRepositoryException(
        'Booking này chưa sẵn sàng để chủ xe từ chối.',
      )
    }
    await this.assert(
      supabase
        .from('bookings')
        .update({
          status: BookingStatusDb[BookingStatus.rejectedByOwner],
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id),
    )
    await this.syncCarToAvailableIfNoActiveBooking(booking.carId)
    await this.insertHistory({
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: BookingStatus.rejectedByOwner,
      note: 'Chủ xe đã từ chối booking.',
      changedBy: input.actor.id,
    })
    await this.insertNotification(booking.customerId, {
      title: 'Booking bá»‹ tá»« chá»‘i',
      message: `Chủ xe đã từ chối booking ${booking.code}. Xe đã sẵn sàng để đặt lại.`,
      type: NotificationType.warning,
    })
  }

  async renterMarkReceivedCar(input: {
    actor: Profile
    bookingId: string
  }): Promise<void> {
    this.requireRole(input.actor, UserRole.renter)
    const booking = await this.fetchBooking(input.bookingId)
    if (!booking || booking.customerId !== input.actor.id) {
      throw new TripDriverRepositoryException(
        'Bạn chỉ có thể bắt đầu chuyến đi của chính mình.',
      )
    }
    if (booking.status !== BookingStatus.confirmed) {
      throw new TripDriverRepositoryException(
        'Chỉ booking đã được xác nhận mới có thể chuyển sang đang trong chuyến.',
      )
    }
    await this.assert(
      supabase
        .from('bookings')
        .update({
          status: BookingStatusDb[BookingStatus.inProgress],
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id),
    )
    await this.assert(
      supabase
        .from('cars')
        .update({
          status: CarStatusDb[CarStatus.rented],
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.carId),
    )
    await this.insertHistory({
      bookingId: booking.id,
      fromStatus: booking.status,
      toStatus: BookingStatus.inProgress,
      note: 'Người thuê đã xác nhận nhận xe và sẽ thanh toán phần còn lại trực tiếp cho chủ xe.',
      changedBy: input.actor.id,
    })
  }

  async renterMarkReturnedCar(input: {
    actor: Profile
    bookingId: string
  }): Promise<void> {
    this.requireRole(input.actor, UserRole.renter)
    const booking = await this.fetchBooking(input.bookingId)
    if (!booking || booking.customerId !== input.actor.id) {
      throw new TripDriverRepositoryException(
        'Bạn chỉ có thể báo trả xe cho chuyến đi của chính mình.',
      )
    }
    if (booking.status !== BookingStatus.inProgress) {
      throw new TripDriverRepositoryException(
        'Chỉ chuyến đi đang diễn ra mới có thể báo đã trả xe.',
      )
    }

    await this.assert(
      supabase
        .from('bookings')
        .update({
          status: BookingStatusDb[BookingStatus.pendingOwnerCompletion],
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id),
    )
    await this.assert(
      supabase
        .from('cars')
        .update({
          status: CarStatusDb[CarStatus.rented],
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.carId),
    )

    await this.insertHistory({
      bookingId: booking.id,
      fromStatus: BookingStatus.inProgress,
      toStatus: BookingStatus.pendingOwnerCompletion,
      note: 'Người thuê đã báo hoàn tất trả xe và đang chờ chủ xe xác nhận hoàn thành chuyến đi.',
      changedBy: input.actor.id,
    })
    await this.insertNotification(booking.ownerId, {
      title: 'Người thuê báo đã trả xe',
      message: `Người thuê đã báo trả xe cho booking ${booking.code}. Hãy kiểm tra và xác nhận hoàn thành chuyến đi.`,
      type: NotificationType.info,
    })
    await this.insertNotification(booking.customerId, {
      title: 'Đã gửi yêu cầu xác nhận trả xe',
      message: `Bạn đã báo trả xe cho booking ${booking.code}. Hãy chờ chủ xe xác nhận hoàn thành chuyến đi.`,
      type: NotificationType.info,
    })
  }

  async ownerCompleteTrip(input: {
    actor: Profile
    bookingId: string
  }): Promise<void> {
    this.requireRole(input.actor, UserRole.owner)
    const booking = await this.fetchBooking(input.bookingId)
    if (!booking || booking.ownerId !== input.actor.id) {
      throw new TripDriverRepositoryException(
        'Bạn chỉ có thể hoàn thành chuyến đi của xe thuộc mình.',
      )
    }
    if (booking.status !== BookingStatus.pendingOwnerCompletion) {
      throw new TripDriverRepositoryException(
        'Chỉ chuyến đi đã được người thuê báo hoàn tất trả xe mới có thể được chủ xe hoàn thành.',
      )
    }
    await this.assert(
      supabase
        .from('bookings')
        .update({
          status: BookingStatusDb[BookingStatus.completed],
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id),
    )
    await this.assert(
      supabase
        .from('cars')
        .update({
          status: CarStatusDb[CarStatus.active],
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.carId),
    )
    await this.insertHistory({
      bookingId: booking.id,
      fromStatus: BookingStatus.pendingOwnerCompletion,
      toStatus: BookingStatus.completed,
      note: 'Chủ xe đã hoàn thành chuyến đi sau khi kiểm tra nhận lại xe.',
      changedBy: input.actor.id,
    })
    await this.insertNotification(booking.customerId, {
      title: 'Chuyến đi hoàn thành',
      message: `Booking ${booking.code} đã hoàn thành. Bạn có thể gửi một đánh giá.`,
      type: NotificationType.success,
    })
  }

  async submitReview(input: {
    actor: Profile
    bookingId: string
    rating: number
    comment: string
  }): Promise<void> {
    this.requireRole(input.actor, UserRole.renter)
    const booking = await this.fetchBooking(input.bookingId)
    if (!booking || booking.customerId !== input.actor.id) {
      throw new TripDriverRepositoryException(
        'Bạn chỉ có thể đánh giá booking của chính mình.',
      )
    }
    if (booking.status !== BookingStatus.completed) {
      throw new TripDriverRepositoryException(
        'Chỉ có thể đánh giá sau khi booking đã hoàn thành.',
      )
    }
    const { data: existing, error: existingError } = await supabase
      .from('car_reviews')
      .select('id')
      .eq('booking_id', input.bookingId)
      .maybeSingle()
    if (existingError) {
      throw new TripDriverRepositoryException(existingError.message)
    }
    if (existing) {
      throw new TripDriverRepositoryException(
        'Booking này đã có đánh giá trước đó.',
      )
    }
    await this.assert(
      supabase.from('car_reviews').insert({
        booking_id: booking.id,
        car_id: booking.carId,
        owner_id: booking.ownerId,
        customer_id: input.actor.id,
        rating: input.rating,
        comment: input.comment.trim(),
      }),
    )
    await this.insertNotification(booking.ownerId, {
      title: 'Có đánh giá mới',
      message: `Người thuê đã gửi đánh giá cho booking ${booking.code}.`,
      type: NotificationType.success,
    })
  }

  async updateProfile(input: {
    actor: Profile
    fullName: string
    phone: string
    city: string
    address: string
  }): Promise<Profile> {
    await this.assert(
      supabase
        .from('profiles')
        .update({
          full_name: input.fullName.trim(),
          phone: input.phone.trim(),
          city: input.city.trim(),
          address: input.address.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.actor.id),
    )
    const updated = await this.fetchProfile(input.actor.id)
    if (!updated) {
      throw new TripDriverRepositoryException(
        'Đã cập nhật hồ sơ nhưng không thể tải lại dữ liệu mới nhất.',
      )
    }
    return updated
  }

  async toggleCarVisibility(input: {
    actor: Profile
    carId: string
    nextStatus: CarStatus
  }): Promise<void> {
    this.requireRole(input.actor, UserRole.owner)
    if (
      input.nextStatus !== CarStatus.active &&
      input.nextStatus !== CarStatus.deactive
    ) {
      throw new TripDriverRepositoryException(
        'Chỉ có thể chuyển xe sang trạng thái đang mở hoặc đã ẩn.',
      )
    }
    const car = await this.fetchCar(input.carId)
    if (!car || car.ownerId !== input.actor.id) {
      throw new TripDriverRepositoryException(
        'Bạn chỉ có thể cập nhật hiển thị cho xe của mình.',
      )
    }
    if (car.status === CarStatus.held || car.status === CarStatus.rented) {
      throw new TripDriverRepositoryException(
        'Xe đang giữ chỗ hoặc đang thuê không thể đổi hiển thị.',
      )
    }
    await this.assert(
      supabase
        .from('cars')
        .update({
          status: CarStatusDb[input.nextStatus],
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.carId),
    )
  }

  async createCar(input: {
    actor: Profile
    input: CreateCarInput
  }): Promise<void> {
    this.requireRole(input.actor, UserRole.owner)
    const { data, error } = await supabase.rpc('app_owner_create_car', {
      p_brand: input.input.brand.trim(),
      p_model: input.input.model.trim(),
      p_year: input.input.year,
      p_transmission: input.input.transmission.trim(),
      p_fuel: input.input.fuel.trim(),
      p_seats: input.input.seats,
      p_location: input.input.location.trim(),
      p_price_per_day: input.input.pricePerDay,
      p_description: input.input.description.trim(),
      p_active_now: input.input.activeNow,
      p_image_url: input.input.imageUrl.trim(),
    })
    if (error) {
      throw new TripDriverRepositoryException(
        this.normalizeDatabaseError(error.message),
      )
    }
    const payload = (data ?? {}) as Record<string, unknown>
    if (!String(payload.car_id ?? '')) {
      throw new TripDriverRepositoryException(
        'Đã tạo xe nhưng không nhận được mã xe mới.',
      )
    }
  }

  private async loadRenterSnapshot(profile: Profile): Promise<TripDriverSnapshot> {
    const bookings = await this.fetchBookingsByField('customer_id', profile.id)
    const activeCars = await this.fetchCarsByField(
      'status',
      CarStatusDb[CarStatus.active],
    )
    const bookingCarIds = new Set(bookings.map((item) => item.carId))
    const knownCarIds = new Set(activeCars.map((item) => item.id))
    const missingCarIds = [...bookingCarIds].filter((id) => !knownCarIds.has(id))
    const extraCars = missingCarIds.length
      ? await this.fetchCarsByIds(missingCarIds)
      : []
    const allCarIds = [...activeCars.map((item) => item.id), ...missingCarIds]
    const carImages = await this.fetchCarImages(allCarIds)
    const cars = this.attachPrimaryImages(
      this.dedupeCars([...activeCars, ...extraCars]),
      carImages,
    )
    const carIds = cars.map((item) => item.id)
    const reviews = await this.fetchReviews(carIds)
    const bookingIds = bookings.map((item) => item.id)
    const payments = await this.fetchPayments(bookingIds)
    const history = await this.fetchHistory(bookingIds)
    const notifications = await this.fetchNotifications(profile.id)
    const visibleOwnerIds = bookings
      .filter((item) => this.canExposeOwnerContact(item.status))
      .map((item) => item.ownerId)
    const reviewerIds = reviews.map((item) => item.customerId)
    const profiles = await this.fetchProfilesByIds([
      profile.id,
      ...visibleOwnerIds,
      ...reviewerIds,
    ])
    const profileMap = new Map(profiles.map((item) => [item.id, item]))
    const hydratedReviews = reviews.map((item) => ({
      ...item,
      customerName: profileMap.get(item.customerId)?.fullName ?? 'Người dùng TripDriver',
    }))
    const bookingCodeById = new Map(bookings.map((item) => [item.id, item.code]))
    const finalPayments = payments.map((item) => ({
      ...item,
      transferContent: PaymentConfig.transferNote(
        bookingCodeById.get(item.bookingId) ?? '',
      ),
    }))
    return {
      profiles,
      cars,
      carImages,
      bookings,
      payments: finalPayments,
      reviews: hydratedReviews,
      notifications,
      bookingStatusHistory: history,
    }
  }

  private async loadOwnerSnapshot(profile: Profile): Promise<TripDriverSnapshot> {
    const rawCars = await this.fetchCarsByField('owner_id', profile.id)
    const carIds = rawCars.map((item) => item.id)
    const carImages = await this.fetchCarImages(carIds)
    const cars = this.attachPrimaryImages(rawCars, carImages)
    const bookings = (await this.fetchBookingsByField('owner_id', profile.id)).filter(
      (item) =>
        item.status !== BookingStatus.pendingDeposit &&
        item.status !== BookingStatus.pendingAdminPaymentReview,
    )
    const bookingIds = bookings.map((item) => item.id)
    const payments = await this.fetchPayments(bookingIds)
    const history = await this.fetchHistory(bookingIds)
    const notifications = await this.fetchNotifications(profile.id)
    const profiles = await this.fetchProfilesByIds([
      profile.id,
      ...bookings.map((item) => item.customerId),
    ])
    const bookingCodeById = new Map(bookings.map((item) => [item.id, item.code]))
    return {
      profiles,
      cars,
      carImages,
      bookings,
      payments: payments.map((item) => ({
        ...item,
        transferContent: PaymentConfig.transferNote(
          bookingCodeById.get(item.bookingId) ?? '',
        ),
      })),
      reviews: [],
      notifications,
      bookingStatusHistory: history,
    }
  }

  private async loadAdminSnapshot(profile: Profile): Promise<TripDriverSnapshot> {
    const profiles = await this.fetchAllProfiles()
    const rawCars = await this.fetchAllCars()
    const carIds = rawCars.map((item) => item.id)
    const carImages = await this.fetchCarImages(carIds)
    const cars = this.attachPrimaryImages(rawCars, carImages)
    const bookings = await this.fetchAllBookings()
    const bookingIds = bookings.map((item) => item.id)
    const payments = await this.fetchPayments(bookingIds)
    const history = await this.fetchHistory(bookingIds)
    const notifications = await this.fetchNotifications(profile.id)
    const bookingCodeById = new Map(bookings.map((item) => [item.id, item.code]))
    return {
      profiles,
      cars,
      carImages,
      bookings,
      payments: payments.map((item) => ({
        ...item,
        transferContent: PaymentConfig.transferNote(
          bookingCodeById.get(item.bookingId) ?? '',
        ),
      })),
      reviews: [],
      notifications,
      bookingStatusHistory: history,
    }
  }

  private async expireStaleBookingsFallback(): Promise<void> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .in('status', [
        BookingStatusDb[BookingStatus.pendingDeposit],
        BookingStatusDb[BookingStatus.pendingAdminPaymentReview],
      ])
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    const bookings = (data ?? []).map((row) => this.bookingFromRow(row))
    const now = Date.now()
    for (const booking of bookings) {
      const hold = new Date(this.effectiveHoldExpiresAt(booking)).getTime()
      if (hold > now) {
        continue
      }
      await this.assert(
        supabase
          .from('bookings')
          .update({
            status: BookingStatusDb[BookingStatus.expired],
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.id),
      )
      const payment = await this.fetchPaymentForBooking(booking.id)
      if (payment && payment.status === PaymentStatus.pending) {
        await this.assert(
          supabase
            .from('payments')
            .update({
              status: PaymentStatusDb[PaymentStatus.failed],
              updated_at: new Date().toISOString(),
            })
            .eq('id', payment.id),
        )
      }
      await this.syncCarToAvailableIfNoActiveBooking(booking.carId)
      await this.insertHistory({
        bookingId: booking.id,
        fromStatus: booking.status,
        toStatus: BookingStatus.expired,
        note: 'Booking đã hết hạn vì quá thời gian giữ chỗ 1 giờ.',
        changedBy: null,
      })
    }
  }

  private async ensureProfileForAuthUser(user: {
    id: string
    email?: string | null
    user_metadata?: Record<string, unknown> | null
  }): Promise<Profile | null> {
    const existing = await this.fetchProfile(user.id)
    if (existing) {
      return existing
    }
    return this.upsertProfileForUser(user)
  }

  private async upsertProfileForUser(
    user: {
      id: string
      email?: string | null
      user_metadata?: Record<string, unknown> | null
    },
    overrides?: {
      fullName?: string
      phone?: string
      role?: UserRole
    },
  ): Promise<Profile | null> {
    const metadata = user.user_metadata ?? {}
    const fullName = (
      overrides?.fullName ??
      String(metadata.full_name ?? metadata.name ?? '')
    ).trim()
    const phone = (
      overrides?.phone ??
      String(metadata.phone ?? '')
    ).trim()
    const role =
      overrides?.role ??
      userRoleFromDb(String(metadata.app_role ?? metadata.role ?? 'RENTER'))

    await this.assert(
      supabase.from('profiles').upsert({
        id: user.id,
        email: String(user.email ?? '').trim().toLowerCase(),
        full_name: fullName,
        phone,
        city: '',
        address: '',
        avatar_url: '',
        role: UserRoleDb[role],
        is_active: true,
        updated_at: new Date().toISOString(),
      }),
    )

    return this.fetchProfile(user.id)
  }

  private async fetchProfile(id: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    return data ? this.profileFromRow(data) : null
  }

  private async fetchBooking(id: string): Promise<Booking | null> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    return data ? this.bookingFromRow(data) : null
  }

  private async fetchPaymentForBooking(bookingId: string): Promise<Payment | null> {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at')
      .limit(1)
      .maybeSingle()
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    return data ? this.paymentFromRow(data) : null
  }

  private async fetchCar(id: string): Promise<Car | null> {
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    return data ? this.carFromRow(data) : null
  }

  private async fetchProfileIdsByRole(role: UserRole): Promise<string[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', UserRoleDb[role])
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    return (data ?? []).map((row) => String((row as DbRow).id))
  }

  private async fetchProfilesByIds(ids: string[]): Promise<Profile[]> {
    const uniqueIds = [...new Set(ids.filter(Boolean))]
    if (!uniqueIds.length) {
      return []
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('id', uniqueIds)
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    return (data ?? []).map((row) => this.profileFromRow(row))
  }

  private async fetchAllProfiles(): Promise<Profile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    return (data ?? []).map((row) => this.profileFromRow(row))
  }

  private async fetchCarsByField(field: string, value: string): Promise<Car[]> {
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .eq(field, value)
      .order('created_at', { ascending: false })
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    return (data ?? []).map((row) => this.carFromRow(row))
  }

  private async fetchCarsByIds(ids: string[]): Promise<Car[]> {
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false })
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    return (data ?? []).map((row) => this.carFromRow(row))
  }

  private async fetchAllCars(): Promise<Car[]> {
    const { data, error } = await supabase
      .from('cars')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    return (data ?? []).map((row) => this.carFromRow(row))
  }

  private async fetchCarImages(carIds: string[]): Promise<CarImage[]> {
    const uniqueIds = [...new Set(carIds.filter(Boolean))]
    if (!uniqueIds.length) {
      return []
    }
    const { data, error } = await supabase
      .from('car_images')
      .select('*')
      .in('car_id', uniqueIds)
      .order('sort_order')
      .order('created_at')
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    return (data ?? []).map((row) => this.carImageFromRow(row))
  }

  private async fetchBookingsByField(
    field: string,
    value: string,
  ): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq(field, value)
      .order('created_at', { ascending: false })
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    return (data ?? []).map((row) => this.bookingFromRow(row))
  }

  private async fetchAllBookings(): Promise<Booking[]> {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    return (data ?? []).map((row) => this.bookingFromRow(row))
  }

  private async fetchReviews(carIds: string[]): Promise<CarReview[]> {
    const uniqueIds = [...new Set(carIds.filter(Boolean))]
    if (!uniqueIds.length) {
      return []
    }
    const { data, error } = await supabase
      .from('car_reviews')
      .select('*')
      .in('car_id', uniqueIds)
      .order('created_at', { ascending: false })
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    return (data ?? []).map((row) => this.reviewFromRow(row))
  }

  private async fetchPayments(bookingIds: string[]): Promise<Payment[]> {
    const uniqueIds = [...new Set(bookingIds.filter(Boolean))]
    if (!uniqueIds.length) {
      return []
    }
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .in('booking_id', uniqueIds)
      .order('created_at', { ascending: false })
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    return (data ?? []).map((row) => this.paymentFromRow(row))
  }

  private async fetchHistory(bookingIds: string[]): Promise<BookingStatusHistory[]> {
    const uniqueIds = [...new Set(bookingIds.filter(Boolean))]
    if (!uniqueIds.length) {
      return []
    }
    const { data, error } = await supabase
      .from('booking_status_history')
      .select('*')
      .in('booking_id', uniqueIds)
      .order('created_at', { ascending: false })
    if (error) {
      if (this.isAuxiliaryPermissionError(error.message)) {
        console.warn('[TripDriver] Skip booking_status_history read:', error.message)
        return []
      }
      throw new TripDriverRepositoryException(error.message)
    }
    return (data ?? []).map((row) => this.historyFromRow(row))
  }

  private async fetchNotifications(userId: string): Promise<NotificationItem[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('receiver_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12)
    if (error) {
      if (this.isAuxiliaryPermissionError(error.message)) {
        console.warn('[TripDriver] Skip notifications read:', error.message)
        return []
      }
      throw new TripDriverRepositoryException(error.message)
    }
    return (data ?? []).map((row) => this.notificationFromRow(row))
  }

  private async syncCarToAvailableIfNoActiveBooking(carId: string): Promise<void> {
    const { data, error } = await supabase
      .from('bookings')
      .select('status')
      .eq('car_id', carId)
    if (error) {
      throw new TripDriverRepositoryException(error.message)
    }
    const statuses = (data ?? []).map((row) =>
      bookingStatusFromDb(String((row as DbRow).status ?? '')),
    )
    const hasInProgress = statuses.some((status) =>
      [BookingStatus.inProgress, BookingStatus.pendingOwnerCompletion].includes(status),
    )
    const hasHeld = statuses.some((status) =>
      [
        BookingStatus.pendingDeposit,
        BookingStatus.pendingAdminPaymentReview,
        BookingStatus.pendingOwnerConfirmation,
        BookingStatus.confirmed,
      ].includes(status),
    )
    const nextStatus = hasInProgress
      ? CarStatus.rented
      : hasHeld
        ? CarStatus.held
        : CarStatus.active
    await this.assert(
      supabase
        .from('cars')
        .update({
          status: CarStatusDb[nextStatus],
          updated_at: new Date().toISOString(),
        })
        .eq('id', carId),
    )
  }

  private async insertHistory(input: {
    bookingId: string
    fromStatus: BookingStatus | null
    toStatus: BookingStatus
    note: string
    changedBy: string | null
  }): Promise<void> {
    const { error } = await supabase.from('booking_status_history').insert({
      booking_id: input.bookingId,
      from_status: input.fromStatus ? BookingStatusDb[input.fromStatus] : null,
      to_status: BookingStatusDb[input.toStatus],
      changed_by: input.changedBy,
      note: input.note,
    })
    if (!error) {
      return
    }
    if (this.isAuxiliaryPermissionError(error.message)) {
      console.warn('[TripDriver] Skip booking_status_history insert:', error.message)
      return
    }
    throw new TripDriverRepositoryException(
      this.normalizeDatabaseError(error.message),
    )
  }

  private async insertNotification(
    userId: string,
    input: { title: string; message: string; type: NotificationType },
  ): Promise<void> {
    const { error } = await supabase.from('notifications').insert({
      receiver_user_id: userId,
      type: NotificationTypeDb[input.type],
      title: input.title,
      content: input.message,
    })
    if (!error) {
      return
    }
    if (this.isAuxiliaryPermissionError(error.message)) {
      console.warn('[TripDriver] Skip notification insert:', error.message)
      return
    }
    throw new TripDriverRepositoryException(
      this.normalizeDatabaseError(error.message),
    )
  }

  private async insertNotifications(
    userIds: string[],
    input: { title: string; message: string; type: NotificationType },
  ): Promise<void> {
    const uniqueIds = [...new Set(userIds.filter(Boolean))]
    if (!uniqueIds.length) {
      return
    }
    const { error } = await supabase.from('notifications').insert(
      uniqueIds.map((userId) => ({
        receiver_user_id: userId,
        type: NotificationTypeDb[input.type],
        title: input.title,
        content: input.message,
      })),
    )
    if (!error) {
      return
    }
    if (this.isAuxiliaryPermissionError(error.message)) {
      console.warn('[TripDriver] Skip bulk notification insert:', error.message)
      return
    }
    throw new TripDriverRepositoryException(
      this.normalizeDatabaseError(error.message),
    )
  }

  private requireRole(actor: Profile, role: UserRole): void {
    if (actor.role !== role) {
      throw new TripDriverRepositoryException(
        `Thao tác này yêu cầu quyền ${UserRoleDb[role]}.`,
      )
    }
  }

  private canExposeOwnerContact(status: BookingStatus): boolean {
    return (
      status === BookingStatus.confirmed ||
      status === BookingStatus.inProgress ||
      status === BookingStatus.pendingOwnerCompletion ||
      status === BookingStatus.completed
    )
  }

  private dedupeCars(cars: Car[]): Car[] {
    return [...new Map(cars.map((car) => [car.id, car])).values()]
  }

  private attachPrimaryImages(cars: Car[], images: CarImage[]): Car[] {
    const imagesByCar = new Map<string, CarImage[]>()
    for (const image of images) {
      const list = imagesByCar.get(image.carId) ?? []
      list.push(image)
      imagesByCar.set(image.carId, list)
    }
    return cars.map((car) => {
      const list = imagesByCar.get(car.id) ?? []
      const firstImage = [...list].sort((a, b) => a.sortOrder - b.sortOrder)[0]
      return {
        ...car,
        primaryImage: firstImage?.imageUrl ?? car.primaryImage,
      }
    })
  }

  private profileFromRow(row: DbRow): Profile {
    return {
      id: String(row.id ?? ''),
      email: String(row.email ?? ''),
      fullName: String(row.full_name ?? ''),
      phone: String(row.phone ?? ''),
      city: String(row.city ?? ''),
      address: String(row.address ?? ''),
      avatarUrl: String(row.avatar_url ?? ''),
      role: userRoleFromDb(String(row.role ?? '')),
      isActive: Boolean(row.is_active ?? true),
    }
  }

  private carFromRow(row: DbRow): Car {
    const brand = String(row.brand ?? '')
    const model = String(row.model ?? '')
    const year = this.toInt(row.year)
    return {
      id: String(row.id ?? ''),
      ownerId: String(row.owner_id ?? ''),
      name: [brand, model, year > 0 ? String(year) : ''].filter(Boolean).join(' '),
      brand,
      model,
      year,
      location: String(row.location ?? ''),
      seats: this.toInt(row.seats),
      transmission: String(row.transmission ?? ''),
      fuel: String(row.fuel ?? ''),
      pricePerDay: this.toInt(row.price_per_day),
      depositPercent: this.toInt(row.deposit_percent),
      description: String(row.description ?? ''),
      status: carStatusFromDb(String(row.status ?? '')),
      primaryImage: '',
    }
  }

  private carImageFromRow(row: DbRow): CarImage {
    return {
      id: String(row.id ?? ''),
      carId: String(row.car_id ?? ''),
      imageUrl: String(row.image_url ?? ''),
      sortOrder: this.toInt(row.sort_order),
    }
  }

  private bookingFromRow(row: DbRow): Booking {
    return {
      id: String(row.id ?? ''),
      code: String(row.booking_code ?? ''),
      carId: String(row.car_id ?? ''),
      customerId: String(row.customer_id ?? ''),
      ownerId: String(row.owner_id ?? ''),
      startDate: String(row.start_date ?? ''),
      endDate: String(row.end_date ?? ''),
      pickupNote: String(row.pickup_note ?? ''),
      ownerNote: String(row.customer_note ?? ''),
      totalAmount: this.toInt(row.total_amount),
      depositAmount: this.toInt(row.deposit_amount),
      remainingAmount: this.toInt(row.remaining_amount),
      platformFeeAmount: this.toInt(row.platform_fee_amount),
      ownerPayoutAmount: this.toInt(row.owner_payout_amount),
      status: bookingStatusFromDb(String(row.status ?? '')),
      createdAt: String(row.created_at ?? ''),
      holdExpiresAt:
        row.hold_expires_at == null ? null : String(row.hold_expires_at),
    }
  }

  private paymentFromRow(row: DbRow): Payment {
    return {
      id: String(row.id ?? ''),
      bookingId: String(row.booking_id ?? ''),
      amount: this.toInt(row.amount),
      transferContent: '',
      status: paymentStatusFromDb(String(row.status ?? '')),
      createdAt: String(row.created_at ?? ''),
      method: String(row.method ?? ''),
      type: String(row.type ?? ''),
      markedPaidAt:
        row.submitted_at == null ? null : String(row.submitted_at),
      verifiedAt: row.paid_at == null ? null : String(row.paid_at),
    }
  }

  private reviewFromRow(row: DbRow): CarReview {
    return {
      id: String(row.id ?? ''),
      bookingId: String(row.booking_id ?? ''),
      carId: String(row.car_id ?? ''),
      customerId: String(row.customer_id ?? ''),
      customerName: '',
      rating: this.toInt(row.rating),
      comment: String(row.comment ?? ''),
      createdAt: String(row.created_at ?? ''),
    }
  }

  private notificationFromRow(row: DbRow): NotificationItem {
    return {
      id: String(row.id ?? ''),
      userId: String(row.receiver_user_id ?? ''),
      title: String(row.title ?? ''),
      message: String(row.content ?? ''),
      type: notificationTypeFromDb(String(row.type ?? '')),
      createdAt: String(row.created_at ?? ''),
    }
  }

  private historyFromRow(row: DbRow): BookingStatusHistory {
    return {
      id: String(row.id ?? ''),
      bookingId: String(row.booking_id ?? ''),
      fromStatus:
        row.from_status == null
          ? null
          : bookingStatusFromDb(String(row.from_status)),
      toStatus: bookingStatusFromDb(String(row.to_status ?? '')),
      note: String(row.note ?? ''),
      changedByUserId: String(row.changed_by ?? ''),
      createdAt: String(row.created_at ?? ''),
    }
  }

  private effectiveHoldExpiresAt(booking: Booking): string {
    if (booking.holdExpiresAt) {
      return booking.holdExpiresAt
    }
    return new Date(new Date(booking.createdAt).getTime() + 3600000).toISOString()
  }

  private toInt(value: unknown): number {
    if (typeof value === 'number') {
      return Math.round(value)
    }
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? Math.round(parsed) : 0
  }

  private isoDate(value: Date): string {
    const year = String(value.getFullYear()).padStart(4, '0')
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  private async assert(request: PromiseLike<{ error: { message: string } | null }>) {
    const result = await request
    if (result.error) {
      throw new TripDriverRepositoryException(
        this.normalizeDatabaseError(result.error.message),
      )
    }
  }

  private normalizeDatabaseError(message: string): string {
    const normalized = message.trim()

    if (
      normalized.includes('stack depth limit exceeded') ||
      normalized.includes('infinite recursion')
    ) {
      return 'Phát hiện recursion ở policy hoặc trigger của Supabase khi ghi dữ liệu. Hãy chạy các file SQL trong supabase/migrations, sau đó kiểm tra policy và trigger bằng supabase/sql/20260406_tripdriver_diagnostics.sql.'
    }

    if (this.isMissingTripDriverSchemaError(normalized)) {
      return 'Schema Supabase đang thiếu enum hoặc RPC cần thiết của TripDriver. Hãy chạy các file SQL trong supabase/migrations trước khi dùng luồng này.'
    }

    if (
      normalized.includes('row-level security policy') &&
      normalized.includes('"profiles"')
    ) {
      return 'Tài khoản đã được tạo nhưng hồ sơ chưa thể khởi tạo ở bước này. Nếu project đang bật xác minh email, hãy kiểm tra Gmail để xác minh rồi đăng nhập lại.'
    }

    return normalized
  }

  private isMissingTripDriverSchemaError(message: string): boolean {
    return (
      message.includes('invalid input value for enum booking_status') ||
      message.includes('PENDING_ADMIN_PAYMENT_REVIEW') ||
      message.includes('PENDING_OWNER_CONFIRMATION') ||
      message.includes('Could not find the function public.app_expire_stale_bookings') ||
      message.includes('Could not find the function public.app_create_booking_with_hold') ||
      message.includes('Could not find the function public.app_reconcile_car_statuses') ||
      message.includes('Could not find the function public.app_owner_create_car') ||
      message.includes('function public.app_expire_stale_bookings') ||
      message.includes('function public.app_create_booking_with_hold') ||
      message.includes('function public.app_reconcile_car_statuses') ||
      message.includes('function public.app_owner_create_car')
    )
  }

  private isAuxiliaryPermissionError(message: string): boolean {
    const normalized = message.toLowerCase()
    return (
      normalized.includes('row-level security policy') ||
      normalized.includes('permission denied') ||
      normalized.includes('violates row-level security')
    )
  }
}
