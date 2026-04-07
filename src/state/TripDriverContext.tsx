import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'

import { AppPage } from '../app/appPage'
import { SupabaseTripDriverRepository } from '../data/supabaseTripDriverRepository'
import { TripDriverRepositoryException } from '../data/tripDriverRepository'
import {
  BookingStatus,
  CarStatus,
  NotificationType,
  PaymentStatus,
  UserRole,
  effectiveHoldExpiresAt,
  placeholderProfile,
  type Booking,
  type BookingStatusHistory,
  type Car,
  type CarImage,
  type CarReview,
  type NotificationItem,
  type Payment,
  type Profile,
} from '../domain/models'

type MessageState = {
  text: string | null
  type: NotificationType | null
}

type TripDriverContextValue = {
  profiles: Profile[]
  cars: Car[]
  carImages: CarImage[]
  bookings: Booking[]
  payments: Payment[]
  reviews: CarReview[]
  notifications: NotificationItem[]
  bookingStatusHistory: BookingStatusHistory[]
  currentUser: Profile | null
  page: AppPage
  selectedCarId: string | null
  selectedBookingId: string | null
  loginMode: boolean
  isBootstrapping: boolean
  isWorking: boolean
  message: MessageState
  setLoginMode: (value: boolean) => void
  clearMessage: () => void
  signIn: (email: string, password: string) => Promise<void>
  register: (input: {
    fullName: string
    email: string
    phone: string
    password: string
    role?: UserRole
  }) => Promise<void>
  logout: () => Promise<void>
  refreshData: (silent?: boolean) => Promise<void>
  goTo: (page: AppPage, options?: { carId?: string; bookingId?: string }) => void
  openCar: (carId: string) => void
  openBooking: (bookingId: string, nextPage?: AppPage) => void
  selectedCar: Car | null
  selectedBooking: Booking | null
  paymentForBooking: (bookingId: string) => Payment | null
  activeCars: Car[]
  imagesForCar: (carId: string) => CarImage[]
  reviewsForCar: (carId: string) => CarReview[]
  averageRatingForCar: (carId: string) => number
  bookingsForCurrentUser: () => Booking[]
  ownerVisibleBookings: () => Booking[]
  carsForOwner: (ownerId: string) => Car[]
  canUserSeeOwnerInfo: (booking: Booking) => boolean
  visibleOwnerProfileForBooking: (booking: Booking) => Profile | null
  bookingHasReturnRequest: (bookingId: string) => boolean
  createBookingDraft: (input: {
    carId: string
    startDate: Date
    endDate: Date
    pickupNote: string
    ownerNote: string
  }) => Promise<void>
  markDepositAsTransferred: (bookingId: string) => Promise<void>
  cancelBooking: (bookingId: string) => Promise<void>
  adminApproveDeposit: (bookingId: string) => Promise<void>
  adminMarkPaymentFailed: (bookingId: string) => Promise<void>
  ownerConfirmBooking: (bookingId: string) => Promise<void>
  ownerRejectBooking: (bookingId: string) => Promise<void>
  renterMarkReceivedCar: (bookingId: string) => Promise<void>
  renterMarkReturnedCar: (bookingId: string) => Promise<void>
  ownerCompleteTrip: (bookingId: string) => Promise<void>
  submitReview: (input: {
    bookingId: string
    rating: number
    comment: string
  }) => Promise<void>
  updateProfile: (input: {
    fullName: string
    phone: string
    city: string
    address: string
  }) => Promise<void>
  toggleCarVisibility: (carId: string, nextStatus: CarStatus) => Promise<void>
  createCar: (input: {
    name: string
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
  }) => Promise<void>
  profileById: (id: string) => Profile
  carById: (id: string) => Car
  bookingStatusLabel: (status: BookingStatus) => string
  carStatusLabel: (status: CarStatus) => string
  paymentStatusLabel: (status: PaymentStatus) => string
  historyForBooking: (bookingId: string) => BookingStatusHistory[]
  notificationsForCurrentUser: () => NotificationItem[]
  ownerTotalOrders: (ownerId: string) => number
  ownerTotalRevenue: (ownerId: string) => number
  ownerPlatformFees: (ownerId: string) => number
  ownerPayoutTotal: (ownerId: string) => number
  adminTotalPlatformFee: () => number
  adminTotalDepositCollected: () => number
  adminTotalOwnerPayout: () => number
  adminPendingDepositBookings: () => Booking[]
}

const repository = new SupabaseTripDriverRepository()
const TripDriverContext = createContext<TripDriverContextValue | null>(null)

const emptyCar: Car = {
  id: '',
  ownerId: '',
  name: 'Xe không xác định',
  brand: '',
  model: '',
  year: 0,
  location: '',
  seats: 0,
  transmission: '',
  fuel: '',
  pricePerDay: 0,
  depositPercent: 20,
  description: '',
  status: CarStatus.deactive,
  primaryImage: '',
}

export function TripDriverProvider({ children }: PropsWithChildren) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [cars, setCars] = useState<Car[]>([])
  const [carImages, setCarImages] = useState<CarImage[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [reviews, setReviews] = useState<CarReview[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [bookingStatusHistory, setBookingStatusHistory] = useState<
    BookingStatusHistory[]
  >([])
  const [localBookingFallbacks, setLocalBookingFallbacks] = useState<Booking[]>([])
  const [localPaymentFallbacks, setLocalPaymentFallbacks] = useState<Payment[]>([])
  const [localCarFallbacks, setLocalCarFallbacks] = useState<Car[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [page, setPage] = useState<AppPage>(AppPage.auth)
  const [selectedCarId, setSelectedCarId] = useState<string | null>(null)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [loginMode, setLoginMode] = useState(true)
  const [isBootstrapping, setIsBootstrapping] = useState(true)
  const [isWorking, setIsWorking] = useState(false)
  const [message, setMessage] = useState<MessageState>({ text: null, type: null })
  const isRefreshingRef = useRef(false)

  useEffect(() => {
    void (async () => {
      try {
        const user = await repository.restoreSessionProfile()
        if (user) {
          const snapshot = await repository.loadSnapshot(user)
          setCurrentUser(user)
          setPage(homePageForRole(user.role))
          applySnapshot(snapshot)
        } else {
          setPage(AppPage.auth)
        }
      } catch (error) {
        setCurrentUser(null)
        setPage(AppPage.auth)
        logBackgroundError(error, 'Không thể khởi tạo ứng dụng.')
      } finally {
        setIsBootstrapping(false)
      }
    })()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!currentUser || isRefreshingRef.current) {
        return
      }
      void refreshData(true)
    }, 30000)

    return () => window.clearInterval(timer)
  })

  function applySnapshot(snapshot: {
    profiles: Profile[]
    cars: Car[]
    carImages: CarImage[]
    bookings: Booking[]
    payments: Payment[]
    reviews: CarReview[]
    notifications: NotificationItem[]
    bookingStatusHistory: BookingStatusHistory[]
  }) {
    const snapshotBookingIds = new Set(snapshot.bookings.map((item) => item.id))
    const snapshotPaymentIds = new Set(snapshot.payments.map((item) => item.id))
    const mergedBookings = mergeById(snapshot.bookings, localBookingFallbacks)
    const mergedPayments = mergeById(snapshot.payments, localPaymentFallbacks)
    setProfiles(snapshot.profiles)
    setCars(snapshot.cars)
    setCarImages(snapshot.carImages)
    setBookings(mergedBookings)
    setPayments(mergedPayments)
    setReviews(snapshot.reviews)
    setNotifications(snapshot.notifications)
    setBookingStatusHistory(snapshot.bookingStatusHistory)
    setLocalBookingFallbacks((prev) =>
      prev.filter((item) => !snapshotBookingIds.has(item.id)),
    )
    setLocalPaymentFallbacks((prev) =>
      prev.filter((item) => !snapshotPaymentIds.has(item.id)),
    )
  }

  async function refreshData(silent = false) {
    if (!currentUser || isRefreshingRef.current) {
      return
    }
    if (!silent) {
      setIsWorking(true)
    }
    try {
      isRefreshingRef.current = true
      const snapshot = await repository.loadSnapshot(currentUser)
      applySnapshot(snapshot)
    } catch (error) {
      if (!silent) {
        setErrorMessage(error, 'Không thể tải lại dữ liệu ứng dụng.')
      } else {
        logBackgroundError(error, 'Không thể tải lại dữ liệu ứng dụng.')
      }
    } finally {
      isRefreshingRef.current = false
      if (!silent) {
        setIsWorking(false)
      }
    }
  }

  function clearMessage() {
    setMessage({ text: null, type: null })
  }

  function setErrorMessage(error: unknown, fallback: string) {
    const text =
      error instanceof TripDriverRepositoryException
        ? error.message
        : error instanceof Error
          ? error.message || fallback
          : fallback
    setMessage({ text, type: NotificationType.warning })
  }

  function logBackgroundError(error: unknown, fallback: string) {
    const text =
      error instanceof TripDriverRepositoryException
        ? error.message
        : error instanceof Error
          ? error.message || fallback
          : fallback
    console.error('[TripDriver background]', text, error)
  }

  async function runAction(
    action: () => Promise<void>,
    fallback: string,
  ): Promise<void> {
    setIsWorking(true)
    try {
      await action()
    } catch (error) {
      setErrorMessage(error, fallback)
    } finally {
      setIsWorking(false)
    }
  }

  async function signIn(email: string, password: string) {
    await runAction(async () => {
      let signedIn = false
      try {
        const user = await repository.signIn({ email, password })
        signedIn = true
        const snapshot = await repository.loadSnapshot(user)
        setLocalBookingFallbacks([])
        setLocalPaymentFallbacks([])
        setLocalCarFallbacks([])
        setBookings([])
        setPayments([])
        setCurrentUser(user)
        setPage(homePageForRole(user.role))
        applySnapshot(snapshot)
        setMessage({
        text: `Chào mừng quay lại, ${user.fullName}.`,
        type: NotificationType.success,
        })
      } catch (error) {
        if (signedIn) {
          await repository.signOut().catch(() => undefined)
          setCurrentUser(null)
          setProfiles([])
          setCars([])
          setCarImages([])
          setBookings([])
          setPayments([])
          setReviews([])
          setNotifications([])
          setBookingStatusHistory([])
          setLocalBookingFallbacks([])
          setLocalPaymentFallbacks([])
          setLocalCarFallbacks([])
          setSelectedCarId(null)
          setSelectedBookingId(null)
          setPage(AppPage.auth)
        }
        throw error
      }
    }, 'Email hoặc mật khẩu không đúng.')
  }

  async function register(input: {
    fullName: string
    email: string
    phone: string
    password: string
    role?: UserRole
  }) {
    await runAction(async () => {
      let signedIn = false
      try {
        const result = await repository.register({
          ...input,
          role: input.role ?? UserRole.renter,
        })
        if (result.requiresEmailConfirmation || !result.profile) {
          setLoginMode(true)
          setPage(AppPage.auth)
          setMessage({
            text: 'Tài khoản đã được tạo. Hãy kiểm tra email để xác minh, sau đó quay lại đăng nhập.',
            type: NotificationType.success,
          })
          return
        }
        const user = result.profile
        signedIn = true
        const snapshot = await repository.loadSnapshot(user)
        setLocalBookingFallbacks([])
        setLocalPaymentFallbacks([])
        setLocalCarFallbacks([])
        setBookings([])
        setPayments([])
        setCurrentUser(user)
        setLoginMode(true)
        setPage(homePageForRole(user.role))
        applySnapshot(snapshot)
        setMessage({
        text: 'Đăng ký thành công. Tài khoản của bạn đã sẵn sàng.',
        type: NotificationType.success,
        })
      } catch (error) {
        if (signedIn) {
          await repository.signOut().catch(() => undefined)
          setCurrentUser(null)
          setProfiles([])
          setCars([])
          setCarImages([])
          setBookings([])
          setPayments([])
          setReviews([])
          setNotifications([])
          setBookingStatusHistory([])
          setLocalBookingFallbacks([])
          setLocalPaymentFallbacks([])
          setLocalCarFallbacks([])
          setSelectedCarId(null)
          setSelectedBookingId(null)
          setPage(AppPage.auth)
        }
        throw error
      }
    }, 'Hiện chưa thể tạo tài khoản của bạn.')
  }

  async function logout() {
    await runAction(async () => {
      await repository.signOut()
      setCurrentUser(null)
      setProfiles([])
      setCars([])
      setCarImages([])
      setBookings([])
      setPayments([])
      setReviews([])
      setNotifications([])
      setBookingStatusHistory([])
      setLocalBookingFallbacks([])
      setLocalPaymentFallbacks([])
      setLocalCarFallbacks([])
      setSelectedCarId(null)
      setSelectedBookingId(null)
      setPage(AppPage.auth)
      setLoginMode(true)
      clearMessage()
    }, 'Không thể đăng xuất.')
  }

  function goTo(nextPage: AppPage, options?: { carId?: string; bookingId?: string }) {
    setPage(nextPage)
    if (options?.carId) {
      setSelectedCarId(options.carId)
    }
    if (options?.bookingId) {
      setSelectedBookingId(options.bookingId)
    }
  }

  function openCar(carId: string) {
    const car = cars.find((item) => item.id === carId)
    if (car) {
      setLocalCarFallbacks((prev) => mergeById([car], prev))
    }
    setSelectedCarId(carId)
    setPage(AppPage.renterCarDetail)
  }

  function openBooking(bookingId: string, nextPage?: AppPage) {
    setSelectedBookingId(bookingId)
    if (nextPage) {
      setPage(nextPage)
    }
  }

  const selectedCar = selectedCarId ? carById(selectedCarId) : null
  const selectedBooking = selectedBookingId
    ? bookings.find((booking) => booking.id === selectedBookingId) ?? null
    : null

  function paymentForBooking(bookingId: string) {
    return payments.find((payment) => payment.bookingId === bookingId) ?? null
  }

  const locallyHeldCarIds = new Set(
    localBookingFallbacks
      .filter((booking) =>
        [
          BookingStatus.pendingDeposit,
          BookingStatus.pendingAdminPaymentReview,
          BookingStatus.pendingOwnerConfirmation,
          BookingStatus.confirmed,
        ].includes(booking.status),
      )
      .map((booking) => booking.carId),
  )

  const activeCars = cars.filter(
    (car) => car.status === CarStatus.active && !locallyHeldCarIds.has(car.id),
  )

  function imagesForCar(carId: string) {
    return [...carImages]
      .filter((image) => image.carId === carId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }

  function reviewsForCar(carId: string) {
    return [...reviews]
      .filter((review) => review.carId === carId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
  }

  function averageRatingForCar(carId: string) {
    const list = reviewsForCar(carId)
    if (!list.length) {
      return 0
    }
    const total = list.reduce((sum, review) => sum + review.rating, 0)
    return total / list.length
  }

  function bookingsForCurrentUser() {
    if (!currentUser) {
      return []
    }
    const list =
      currentUser.role === UserRole.renter
        ? bookings.filter((booking) => booking.customerId === currentUser.id)
        : currentUser.role === UserRole.owner
          ? bookings.filter((booking) => booking.ownerId === currentUser.id)
          : [...bookings]
    return [...list].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }

  function ownerVisibleBookings() {
    if (!currentUser || currentUser.role !== UserRole.owner) {
      return []
    }
    return bookingsForCurrentUser().filter(
      (booking) =>
        booking.status !== BookingStatus.pendingDeposit &&
        booking.status !== BookingStatus.pendingAdminPaymentReview,
    )
  }

  function carsForOwner(ownerId: string) {
    return cars.filter((car) => car.ownerId === ownerId)
  }

  function canUserSeeOwnerInfo(booking: Booking) {
    return (
      booking.status === BookingStatus.confirmed ||
      booking.status === BookingStatus.inProgress ||
      booking.status === BookingStatus.pendingOwnerCompletion ||
      booking.status === BookingStatus.completed
    )
  }

  function visibleOwnerProfileForBooking(booking: Booking) {
    if (!canUserSeeOwnerInfo(booking)) {
      return null
    }
    return profiles.find((profile) => profile.id === booking.ownerId) ?? null
  }

  function bookingHasReturnRequest(bookingId: string) {
    const booking = bookings.find((item) => item.id === bookingId)
    if (booking?.status === BookingStatus.pendingOwnerCompletion) {
      return true
    }
    return historyForBooking(bookingId).some(
      (item) =>
        (item.toStatus === BookingStatus.inProgress ||
          item.toStatus === BookingStatus.pendingOwnerCompletion) &&
        item.changedByUserId === booking?.customerId &&
        isReturnRequestNote(item.note),
    )
  }

  async function createBookingDraft(input: {
    carId: string
    startDate: Date
    endDate: Date
    pickupNote: string
    ownerNote: string
  }) {
    if (!currentUser) {
      setMessage({
        text: 'Vui lòng đăng nhập bằng tài khoản người thuê.',
        type: NotificationType.warning,
      })
      return
    }
    await runAction(async () => {
      const car = cars.find((item) => item.id === input.carId)
      if (car) {
        setLocalCarFallbacks((prev) => mergeById([car], prev))
      }
      const draft = await repository.createBookingDraft({
        actor: currentUser,
        ...input,
      })
      const totalDays = Math.max(
        1,
        Math.floor(
          (input.endDate.getTime() - input.startDate.getTime()) / 86400000,
        ),
      )
      const dailyPrice = car?.pricePerDay ?? 0
      const totalAmount = dailyPrice * totalDays
      const depositAmount = Math.round(totalAmount * 0.2)
      const optimisticBooking: Booking = {
        id: draft.bookingId,
        code: `BOOK-${draft.bookingId.slice(0, 8).toUpperCase()}`,
        carId: input.carId,
        customerId: currentUser.id,
        ownerId: car?.ownerId ?? '',
        startDate: input.startDate.toISOString(),
        endDate: input.endDate.toISOString(),
        pickupNote: input.pickupNote,
        ownerNote: input.ownerNote,
        totalAmount,
        depositAmount,
        remainingAmount: totalAmount - depositAmount,
        platformFeeAmount: depositAmount,
        ownerPayoutAmount: totalAmount - depositAmount,
        status: BookingStatus.pendingDeposit,
        createdAt: new Date().toISOString(),
        holdExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      }
      const optimisticPayment: Payment = {
        id: draft.paymentId,
        bookingId: draft.bookingId,
        amount: depositAmount,
        transferContent: `COC ${optimisticBooking.code}`,
        status: PaymentStatus.pending,
        createdAt: new Date().toISOString(),
        method: 'BANK_TRANSFER',
        type: 'DEPOSIT',
        markedPaidAt: null,
        verifiedAt: null,
      }
      setLocalBookingFallbacks((prev) => mergeById([optimisticBooking], prev))
      setLocalPaymentFallbacks((prev) => mergeById([optimisticPayment], prev))
      setBookings((prev) => mergeById([optimisticBooking], prev))
      setPayments((prev) => mergeById([optimisticPayment], prev))
      setSelectedBookingId(draft.bookingId)
      setPage(AppPage.renterDepositPayment)
      const snapshot = await repository.loadSnapshot(currentUser)
      applySnapshot(snapshot)
      setMessage({
        text: 'Đã tạo đơn thuê. Vui lòng chuyển khoản tiền cọc trong vòng 1 giờ.',
        type: NotificationType.success,
      })
    }, 'Hiện chưa thể tạo đơn thuê này.')
  }

  async function markDepositAsTransferred(bookingId: string) {
    if (!currentUser) {
      return
    }
    await runAction(async () => {
      await repository.submitDeposit({ actor: currentUser, bookingId })
      setLocalBookingFallbacks((prev) =>
        prev.map((item) =>
          item.id === bookingId
            ? { ...item, status: BookingStatus.pendingAdminPaymentReview }
            : item,
        ),
      )
      setLocalPaymentFallbacks((prev) =>
        prev.map((item) =>
          item.bookingId === bookingId
            ? { ...item, markedPaidAt: new Date().toISOString() }
            : item,
        ),
      )
      setBookings((prev) =>
        prev.map((item) =>
          item.id === bookingId
            ? { ...item, status: BookingStatus.pendingAdminPaymentReview }
            : item,
        ),
      )
      setPayments((prev) =>
        prev.map((item) =>
          item.bookingId === bookingId
            ? { ...item, markedPaidAt: new Date().toISOString() }
            : item,
        ),
      )
      setSelectedBookingId(bookingId)
      setPage(AppPage.renterBookingDetail)
      const snapshot = await repository.loadSnapshot(currentUser)
      applySnapshot(snapshot)
      setMessage({
        text: 'Đã ghi nhận bạn báo thanh toán. Đơn đang chờ admin duyệt cọc.',
        type: NotificationType.success,
      })
    }, 'Không thể gửi xác nhận thanh toán cọc.')
  }

  async function cancelBooking(bookingId: string) {
    if (!currentUser) {
      return
    }
    await runAction(async () => {
      await repository.cancelBooking({ actor: currentUser, bookingId })
      setLocalBookingFallbacks((prev) =>
        prev.map((item) =>
          item.id === bookingId
            ? { ...item, status: BookingStatus.cancelled }
            : item,
        ),
      )
      setBookings((prev) =>
        prev.map((item) =>
          item.id === bookingId
            ? { ...item, status: BookingStatus.cancelled }
            : item,
        ),
      )
      setSelectedBookingId(bookingId)
      const snapshot = await repository.loadSnapshot(currentUser)
      applySnapshot(snapshot)
      setMessage({
        text: 'Đã hủy đơn và mở lại trạng thái xe.',
        type: NotificationType.success,
      })
    }, 'Không thể hủy đơn thuê này.')
  }

  async function adminApproveDeposit(bookingId: string) {
    if (!currentUser) {
      return
    }
    await runAction(async () => {
      await repository.adminApproveDeposit({ actor: currentUser, bookingId })
      setSelectedBookingId(bookingId)
      const snapshot = await repository.loadSnapshot(currentUser)
      applySnapshot(snapshot)
      setMessage({
        text: 'Đã duyệt cọc. Chủ xe có thể xử lý đơn này.',
        type: NotificationType.success,
      })
    }, 'Không thể duyệt khoản cọc này.')
  }

  async function adminMarkPaymentFailed(bookingId: string) {
    if (!currentUser) {
      return
    }
    await runAction(async () => {
      await repository.adminRejectDeposit({ actor: currentUser, bookingId })
      setSelectedBookingId(bookingId)
      const snapshot = await repository.loadSnapshot(currentUser)
      applySnapshot(snapshot)
      setMessage({
        text: 'Đã từ chối cọc. Đơn đã hết hạn và xe được mở lại.',
        type: NotificationType.success,
      })
    }, 'Không thể từ chối khoản cọc này.')
  }

  async function ownerConfirmBooking(bookingId: string) {
    if (!currentUser) {
      return
    }
    await runAction(async () => {
      await repository.ownerConfirmBooking({ actor: currentUser, bookingId })
      setSelectedBookingId(bookingId)
      const snapshot = await repository.loadSnapshot(currentUser)
      applySnapshot(snapshot)
      setMessage({
        text: 'Đã xác nhận đơn. Người thuê giờ có thể xem thông tin liên hệ của chủ xe.',
        type: NotificationType.success,
      })
    }, 'Không thể xác nhận đơn thuê này.')
  }

  async function ownerRejectBooking(bookingId: string) {
    if (!currentUser) {
      return
    }
    await runAction(async () => {
      await repository.ownerRejectBooking({ actor: currentUser, bookingId })
      setSelectedBookingId(bookingId)
      const snapshot = await repository.loadSnapshot(currentUser)
      applySnapshot(snapshot)
      setMessage({
        text: 'Đã từ chối đơn. Xe có thể được đặt lại.',
        type: NotificationType.success,
      })
    }, 'Không thể từ chối đơn thuê này.')
  }

  async function renterMarkReceivedCar(bookingId: string) {
    if (!currentUser) {
      return
    }
    await runAction(async () => {
      await repository.renterMarkReceivedCar({ actor: currentUser, bookingId })
      setSelectedBookingId(bookingId)
      const snapshot = await repository.loadSnapshot(currentUser)
      applySnapshot(snapshot)
      setMessage({
        text: 'Chuyến đi đã bắt đầu. Đơn đang ở trạng thái đang thuê.',
        type: NotificationType.success,
      })
    }, 'Không thể xác nhận đã nhận xe.')
  }

  async function renterMarkReturnedCar(bookingId: string) {
    if (!currentUser) {
      return
    }
    await runAction(async () => {
      await repository.renterMarkReturnedCar({ actor: currentUser, bookingId })
      setLocalBookingFallbacks((prev) =>
        prev.map((item) =>
          item.id === bookingId
            ? { ...item, status: BookingStatus.pendingOwnerCompletion }
            : item,
        ),
      )
      setBookings((prev) =>
        prev.map((item) =>
          item.id === bookingId
            ? { ...item, status: BookingStatus.pendingOwnerCompletion }
            : item,
        ),
      )
      setSelectedBookingId(bookingId)
      const snapshot = await repository.loadSnapshot(currentUser)
      applySnapshot(snapshot)
      setMessage({
        text: 'Đã báo trả xe. Hệ thống đang chờ chủ xe xác nhận hoàn thành chuyến đi.',
        type: NotificationType.success,
      })
    }, 'Không thể gửi yêu cầu xác nhận trả xe.')
  }

  async function ownerCompleteTrip(bookingId: string) {
    if (!currentUser) {
      return
    }
    await runAction(async () => {
      await repository.ownerCompleteTrip({ actor: currentUser, bookingId })
      setLocalBookingFallbacks((prev) =>
        prev.map((item) =>
          item.id === bookingId ? { ...item, status: BookingStatus.completed } : item,
        ),
      )
      setBookings((prev) =>
        prev.map((item) =>
          item.id === bookingId ? { ...item, status: BookingStatus.completed } : item,
        ),
      )
      setSelectedBookingId(bookingId)
      const snapshot = await repository.loadSnapshot(currentUser)
      applySnapshot(snapshot)
      setMessage({
        text: 'Chuyến đi đã hoàn thành. Người thuê giờ có thể đánh giá.',
        type: NotificationType.success,
      })
    }, 'Không thể hoàn thành chuyến đi này.')
  }

  async function submitReview(input: {
    bookingId: string
    rating: number
    comment: string
  }) {
    if (!currentUser) {
      return
    }
    await runAction(async () => {
      await repository.submitReview({ actor: currentUser, ...input })
      setSelectedBookingId(input.bookingId)
      setPage(AppPage.renterBookingDetail)
      const snapshot = await repository.loadSnapshot(currentUser)
      applySnapshot(snapshot)
      setMessage({
        text: 'Gửi đánh giá thành công.',
        type: NotificationType.success,
      })
    }, 'Không thể gửi đánh giá này.')
  }

  async function updateProfile(input: {
    fullName: string
    phone: string
    city: string
    address: string
  }) {
    if (!currentUser) {
      return
    }
    await runAction(async () => {
      const user = await repository.updateProfile({ actor: currentUser, ...input })
      setCurrentUser(user)
      const snapshot = await repository.loadSnapshot(user)
      applySnapshot(snapshot)
      setMessage({
        text: 'Cập nhật thông tin thành công.',
        type: NotificationType.success,
      })
    }, 'Không thể cập nhật thông tin cá nhân.')
  }

  async function toggleCarVisibility(carId: string, nextStatus: CarStatus) {
    if (!currentUser) {
      return
    }
    await runAction(async () => {
      await repository.toggleCarVisibility({
        actor: currentUser,
        carId,
        nextStatus,
      })
      const snapshot = await repository.loadSnapshot(currentUser)
      applySnapshot(snapshot)
      setMessage({
        text: 'Đã cập nhật trạng thái xe.',
        type: NotificationType.success,
      })
    }, 'Không thể cập nhật trạng thái xe này.')
  }

  async function createCar(input: {
    name: string
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
  }) {
    if (!currentUser) {
      return
    }
    await runAction(async () => {
      await repository.createCar({
        actor: currentUser,
        input: {
          brand: input.brand || input.name,
          model: input.model,
          year: input.year,
          location: input.location,
          seats: input.seats,
          transmission: input.transmission,
          fuel: input.fuel,
          pricePerDay: input.pricePerDay,
          description: input.description,
          imageUrl: input.imageUrl,
          activeNow: input.activeNow,
        },
      })
      setPage(AppPage.ownerCars)
      const snapshot = await repository.loadSnapshot(currentUser)
      applySnapshot(snapshot)
      setMessage({
        text: 'Tạo xe mới thành công.',
        type: NotificationType.success,
      })
    }, 'Không thể tạo xe này.')
  }

  function profileById(id: string) {
    return profiles.find((profile) => profile.id === id) ?? placeholderProfile(id)
  }

  function carById(id: string) {
    return (
      cars.find((car) => car.id === id) ??
      localCarFallbacks.find((car) => car.id === id) ??
      emptyCar
    )
  }

  function bookingStatusLabel(status: BookingStatus) {
    switch (status) {
      case BookingStatus.pendingDeposit:
        return 'Chờ chuyển khoản cọc'
      case BookingStatus.pendingAdminPaymentReview:
        return 'Chờ admin duyệt cọc'
      case BookingStatus.pendingOwnerConfirmation:
        return 'Chờ chủ xe xác nhận'
      case BookingStatus.confirmed:
        return 'Chủ xe đã xác nhận'
      case BookingStatus.inProgress:
        return 'Đang trong chuyến'
      case BookingStatus.pendingOwnerCompletion:
        return 'Chờ chủ xe xác nhận trả xe'
      case BookingStatus.completed:
        return 'Hoàn thành'
      case BookingStatus.rejectedByOwner:
        return 'Bị chủ xe từ chối'
      case BookingStatus.cancelled:
        return 'Đã hủy'
      case BookingStatus.expired:
        return 'Đã hết hạn'
    }
  }

  function carStatusLabel(status: CarStatus) {
    switch (status) {
      case CarStatus.active:
        return 'Đang mở'
      case CarStatus.held:
        return 'Đang giữ chỗ'
      case CarStatus.rented:
        return 'Đang thuê'
      case CarStatus.deactive:
        return 'Đã ẩn'
    }
  }

  function paymentStatusLabel(status: PaymentStatus) {
    switch (status) {
      case PaymentStatus.pending:
        return 'Chờ xử lý'
      case PaymentStatus.paid:
        return 'Đã duyệt'
      case PaymentStatus.failed:
        return 'Thất bại'
      case PaymentStatus.refunded:
        return 'Đã hoàn tiền'
    }
  }

  function historyForBooking(bookingId: string) {
    const seen = new Set<string>()
    return [...bookingStatusHistory]
      .filter((item) => item.bookingId === bookingId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .filter((item) => {
        const key = `${item.toStatus}|${item.changedByUserId}|${item.createdAt}`
        if (seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })
      .map((item) => ({
        ...item,
        note: normalizeHistoryNote(item.note),
      }))
  }

  function notificationsForCurrentUser() {
    return [...notifications].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }

  function ownerTotalOrders(ownerId: string) {
    return bookings.filter((booking) => booking.ownerId === ownerId).length
  }

  function ownerTotalRevenue(ownerId: string) {
    return bookings
      .filter(
        (booking) =>
          booking.ownerId === ownerId &&
          booking.status !== BookingStatus.cancelled &&
          booking.status !== BookingStatus.expired,
      )
      .reduce((sum, booking) => sum + booking.totalAmount, 0)
  }

  function ownerPlatformFees(ownerId: string) {
    return bookings
      .filter(
        (booking) =>
          booking.ownerId === ownerId &&
          booking.status !== BookingStatus.cancelled &&
          booking.status !== BookingStatus.expired,
      )
      .reduce((sum, booking) => sum + booking.platformFeeAmount, 0)
  }

  function ownerPayoutTotal(ownerId: string) {
    return bookings
      .filter(
        (booking) =>
          booking.ownerId === ownerId &&
          booking.status !== BookingStatus.cancelled &&
          booking.status !== BookingStatus.expired,
      )
      .reduce((sum, booking) => sum + booking.ownerPayoutAmount, 0)
  }

  function adminTotalPlatformFee() {
    return bookings
      .filter(
        (booking) =>
          booking.status !== BookingStatus.cancelled &&
          booking.status !== BookingStatus.expired,
      )
      .reduce((sum, booking) => sum + booking.platformFeeAmount, 0)
  }

  function adminTotalDepositCollected() {
    return payments
      .filter((payment) => payment.status === PaymentStatus.paid)
      .reduce((sum, payment) => sum + payment.amount, 0)
  }

  function adminTotalOwnerPayout() {
    return bookings
      .filter(
        (booking) =>
          booking.status !== BookingStatus.cancelled &&
          booking.status !== BookingStatus.expired,
      )
      .reduce((sum, booking) => sum + booking.ownerPayoutAmount, 0)
  }

  function adminPendingDepositBookings() {
    return bookings
      .filter(
        (booking) =>
          booking.status === BookingStatus.pendingAdminPaymentReview,
      )
      .sort(
        (a, b) =>
          new Date(effectiveHoldExpiresAt(a)).getTime() -
          new Date(effectiveHoldExpiresAt(b)).getTime(),
      )
  }

  const value: TripDriverContextValue = {
    profiles,
    cars,
    carImages,
    bookings,
    payments,
    reviews,
    notifications,
    bookingStatusHistory,
    currentUser,
    page,
    selectedCarId,
    selectedBookingId,
    loginMode,
    isBootstrapping,
    isWorking,
    message,
    setLoginMode,
    clearMessage,
    signIn,
    register,
    logout,
    refreshData,
    goTo,
    openCar,
    openBooking,
    selectedCar,
    selectedBooking,
    paymentForBooking,
    activeCars,
    imagesForCar,
    reviewsForCar,
    averageRatingForCar,
    bookingsForCurrentUser,
    ownerVisibleBookings,
    carsForOwner,
    canUserSeeOwnerInfo,
    visibleOwnerProfileForBooking,
    bookingHasReturnRequest,
    createBookingDraft,
    markDepositAsTransferred,
    cancelBooking,
    adminApproveDeposit,
    adminMarkPaymentFailed,
    ownerConfirmBooking,
    ownerRejectBooking,
    renterMarkReceivedCar,
    renterMarkReturnedCar,
    ownerCompleteTrip,
    submitReview,
    updateProfile,
    toggleCarVisibility,
    createCar,
    profileById,
    carById,
    bookingStatusLabel,
    carStatusLabel,
    paymentStatusLabel,
    historyForBooking,
    notificationsForCurrentUser,
    ownerTotalOrders,
    ownerTotalRevenue,
    ownerPlatformFees,
    ownerPayoutTotal,
    adminTotalPlatformFee,
    adminTotalDepositCollected,
    adminTotalOwnerPayout,
    adminPendingDepositBookings,
  }

  return (
    <TripDriverContext.Provider value={value}>
      {children}
    </TripDriverContext.Provider>
  )
}

function mergeById<T extends { id: string }>(primary: T[], secondary: T[]) {
  const map = new Map<string, T>()
  for (const item of secondary) {
    map.set(item.id, item)
  }
  for (const item of primary) {
    map.set(item.id, item)
  }
  return [...map.values()]
}

function normalizeHistoryNote(note: string) {
  const trimmed = note.trim()
  if (!trimmed) {
    return ''
  }
  switch (trimmed) {
    case 'Booking created and car held for one hour.':
      return ''
    case 'Booking created':
      return ''
    default:
      return trimmed
  }
}

function isReturnRequestNote(note: string) {
  const lowered = normalizeHistoryNote(note).toLowerCase()
  return (
    lowered.includes('trả xe') ||
    lowered.includes('hoàn tất trả xe') ||
    lowered.includes('return')
  )
}

function homePageForRole(role: UserRole) {
  switch (role) {
    case UserRole.renter:
      return AppPage.renterHome
    case UserRole.owner:
      return AppPage.ownerDashboard
    case UserRole.admin:
      return AppPage.adminDashboard
  }
}

export function useTripDriver() {
  const context = useContext(TripDriverContext)
  if (!context) {
    throw new Error('useTripDriver phải được dùng bên trong TripDriverProvider')
  }
  return context
}

