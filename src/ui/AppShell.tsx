import { AppPage } from '../app/appPage'
import { useTripDriver } from '../state/TripDriverContext'
import {
  AuthPage,
  BookingDetailPage,
  CreateBookingPage,
  DepositPaymentPage,
  ProfilePage,
  RenterCarDetailPage,
  RenterHomePage,
  RenterTripsPage,
  ReviewPage,
} from './renterPages'
import {
  OwnerBookingDetailPage,
  OwnerBookingsPage,
  OwnerCarsPage,
  OwnerCreateCarPage,
  OwnerDashboardPage,
} from './ownerPages'
import {
  AdminCarsPage,
  AdminDashboardPage,
  AdminPendingPaymentsPage,
  AdminRecentBookingsPage,
  AdminRevenuePage,
  AdminUsersPage,
} from './adminPages'
import { AppFrame } from './shared'

export function AppShell() {
  const state = useTripDriver()

  return <AppFrame>{renderPage(state.page)}</AppFrame>
}

function renderPage(page: AppPage) {
  switch (page) {
    case AppPage.auth:
      return <AuthPage />
    case AppPage.renterHome:
      return <RenterHomePage />
    case AppPage.renterCarDetail:
      return <RenterCarDetailPage />
    case AppPage.renterCreateBooking:
      return <CreateBookingPage />
    case AppPage.renterDepositPayment:
      return <DepositPaymentPage />
    case AppPage.renterTrips:
      return <RenterTripsPage />
    case AppPage.renterBookingDetail:
      return <BookingDetailPage />
    case AppPage.renterReview:
      return <ReviewPage />
    case AppPage.profile:
      return <ProfilePage />
    case AppPage.ownerDashboard:
      return <OwnerDashboardPage />
    case AppPage.ownerCars:
      return <OwnerCarsPage />
    case AppPage.ownerCreateCar:
      return <OwnerCreateCarPage />
    case AppPage.ownerBookings:
      return <OwnerBookingsPage />
    case AppPage.ownerBookingDetail:
      return <OwnerBookingDetailPage />
    case AppPage.adminDashboard:
      return <AdminDashboardPage />
    case AppPage.adminPendingPayments:
      return <AdminPendingPaymentsPage />
    case AppPage.adminRecentBookings:
      return <AdminRecentBookingsPage />
    case AppPage.adminUsers:
      return <AdminUsersPage />
    case AppPage.adminCars:
      return <AdminCarsPage />
    case AppPage.adminRevenue:
      return <AdminRevenuePage />
  }
}
