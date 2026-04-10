import { useEffect, useRef, useState } from 'react'

import { AppPage } from '../app/appPage'
import { BookingStatus, CarStatus } from '../domain/models'
import { useTripDriver } from '../state/TripDriverContext'
import {
  BookingCard,
  Card,
  CarCard,
  KeyValueRow,
  OwnerBottomNav,
  RoleScaffold,
  StatCard,
  StatusBadge,
  carStatusColor,
  money,
} from './shared'
import { ProfileFieldIcon } from './profileIcons'

const BRAND_MODELS: Record<string, string[]> = {
  Toyota: ['Vios', 'Raize', 'Corolla Cross', 'Veloz Cross', 'Innova', 'Fortuner', 'Camry'],
  Hyundai: ['Grand i10', 'Accent', 'Elantra', 'Creta', 'Tucson', 'Santa Fe', 'Stargazer'],
  Kia: ['Morning', 'Soluto', 'K3', 'Sonet', 'Seltos', 'Carens', 'Carnival'],
  Mazda: ['Mazda2', 'Mazda3', 'CX-3', 'CX-30', 'CX-5', 'CX-8'],
  Honda: ['Brio', 'City', 'Civic', 'HR-V', 'CR-V'],
  Ford: ['Ranger', 'Everest', 'Territory'],
  Mitsubishi: ['Attrage', 'Xpander', 'Xforce', 'Outlander', 'Triton', 'Pajero Sport'],
  VinFast: ['VF 5', 'VF 6', 'VF 7', 'VF 8', 'VF 9'],
  Suzuki: ['Swift', 'Ertiga', 'XL7', 'Ciaz'],
  Nissan: ['Almera', 'Navara', 'Terra'],
}

const CITY_DISTRICTS: Record<string, string[]> = {
  'TP.HCM': [
    'Quận 1',
    'Quận 3',
    'Quận 4',
    'Quận 5',
    'Quận 6',
    'Quận 7',
    'Quận 8',
    'Quận 10',
    'Quận 11',
    'Quận 12',
    'Quận Bình Tân',
    'Quận Bình Thạnh',
    'Quận Gò Vấp',
    'Quận Phú Nhuận',
    'Quận Tân Bình',
    'Quận Tân Phú',
    'TP Thủ Đức',
    'Huyện Bình Chánh',
    'Huyện Cần Giờ',
    'Huyện Củ Chi',
    'Huyện Hóc Môn',
    'Huyện Nhà Bè',
  ],
}

const SEAT_OPTIONS = [4, 5, 7]
const FUEL_OPTIONS = ['Xăng', 'Dầu', 'Điện', 'Hybrid']
const TRANSMISSION_OPTIONS = ['Số tự động', 'Số sàn']

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Không thể đọc ảnh đã chọn.'))
    reader.readAsDataURL(file)
  })
}

export function OwnerDashboardPage() {
  const state = useTripDriver()
  const owner = state.currentUser!
  const bookings = state.ownerVisibleBookings()
  const fleet = state.carsForOwner(owner.id)

  return (
    <RoleScaffold
      title="Bảng điều khiển chủ xe"
      subtitle="Quản lý đội xe, đơn thuê, doanh thu và thực nhận"
      bottomNav={<OwnerBottomNav />}
      headerAction={
        <button className="secondary-button" onClick={() => void state.refreshData()} type="button">
          Làm mới
        </button>
      }
      body={
        <div className="page-stack">
          <div className="stats-grid owner-stats-grid">
            <StatCard label="Tổng số đơn" value={`${state.ownerTotalOrders(owner.id)}`} color="#1565C0" />
            <StatCard label="Phí nền tảng" value={money(state.ownerPlatformFees(owner.id))} color="#EF6C00" />
            <StatCard
              label="Chủ xe thực nhận"
              value={money(state.ownerPayoutTotal(owner.id))}
              color="#6A1B9A"
              className="stat-card-wide"
            />
          </div>
          <Card>
            <h3>Tổng quan đội xe</h3>
            <KeyValueRow label="Tổng số xe" value={`${fleet.length}`} />
            <KeyValueRow label="Xe đang mở" value={`${fleet.filter((car) => car.status === CarStatus.active).length}`} />
            <KeyValueRow label="Xe đang giữ chỗ" value={`${fleet.filter((car) => car.status === CarStatus.held).length}`} />
            <KeyValueRow label="Xe đang thuê" value={`${fleet.filter((car) => car.status === CarStatus.rented).length}`} />
          </Card>
          <h3>Đơn cần xử lý</h3>
          {bookings.slice(0, 5).map((booking) => {
            const car = state.carById(booking.carId)
            return (
              <BookingCard
                key={booking.id}
                booking={booking}
                car={car}
                statusLabel={state.bookingStatusLabel(booking.status)}
                ownerLabel={`Người thuê: ${state.profileById(booking.customerId).fullName}`}
                onClick={() => state.openBooking(booking.id, AppPage.ownerBookingDetail)}
              />
            )
          })}
        </div>
      }
    />
  )
}

export function OwnerCarsPage() {
  const state = useTripDriver()
  const cars = state.carsForOwner(state.currentUser!.id)

  return (
    <RoleScaffold
      title="Xe của tôi"
      subtitle="Bật, tắt hoặc theo dõi tình trạng xe đang giữ chỗ và đang thuê"
      bottomNav={<OwnerBottomNav />}
      headerAction={
        <button
          className="secondary-button"
          onClick={() => void state.refreshData()}
          type="button"
        >
          Làm mới
        </button>
      }
      body={
        <div className="page-stack">
          {cars.map((car) => {
            const reviews = state.reviewsForCar(car.id)
            const avgRating = state.averageRatingForCar(car.id)
            return (
              <Card key={car.id}>
                <CarCard car={car} rating={avgRating} />
                <div className="inline-row">
                  <StatusBadge label={state.carStatusLabel(car.status)} color={carStatusColor(car.status)} />
                  {car.status === CarStatus.active || car.status === CarStatus.deactive ? (
                    <button
                      className="secondary-button inline-button"
                      onClick={() =>
                        void state.toggleCarVisibility(
                          car.id,
                          car.status === CarStatus.active ? CarStatus.deactive : CarStatus.active,
                        )
                      }
                      type="button"
                    >
                      {car.status === CarStatus.active ? 'Ẩn xe' : 'Mở thuê'}
                    </button>
                  ) : (
                    <span className="muted strong-text">Đang bị khóa khi xe giữ chỗ hoặc đang thuê</span>
                  )}
                </div>
                <div className="owner-review-panel">
                  <KeyValueRow
                    label="Đánh giá"
                    value={
                      reviews.length
                        ? `${avgRating.toFixed(1)}/5 (${reviews.length} đánh giá)`
                        : 'Chưa có đánh giá'
                    }
                  />
                  {reviews.slice(0, 2).map((review) => (
                    <div className="owner-review-item" key={review.id}>
                      <div className="inline-row">
                        <strong>{review.customerName}</strong>
                        <span className="owner-review-score">{review.rating}/5</span>
                      </div>
                      <p>{review.comment || 'Người thuê chưa để lại nhận xét chi tiết.'}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      }
    />
  )
}

export function OwnerCreateCarPage() {
  const state = useTripDriver()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [brand, setBrand] = useState('Toyota')
  const [model, setModel] = useState('Vios')
  const [year, setYear] = useState('2023')
  const [city] = useState('TP.HCM')
  const [district, setDistrict] = useState('Quận 1')
  const [seats, setSeats] = useState('5')
  const [transmission, setTransmission] = useState('Số tự động')
  const [fuel, setFuel] = useState('Xăng')
  const [pricePerDay, setPricePerDay] = useState('400000')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [activeNow, setActiveNow] = useState(true)
  const models = BRAND_MODELS[brand] ?? []
  const districts = CITY_DISTRICTS[city] ?? []
  const name = `${brand} ${model} ${year}`.trim()
  const location = `${district}, ${city}`.trim()

  useEffect(() => {
    const nextModels = BRAND_MODELS[brand] ?? []
    if (!nextModels.includes(model)) {
      setModel(nextModels[0] ?? '')
    }
  }, [brand, model])

  useEffect(() => {
    const nextDistricts = CITY_DISTRICTS[city] ?? []
    if (!nextDistricts.includes(district)) {
      setDistrict(nextDistricts[0] ?? '')
    }
  }, [city, district])

  async function handleImageSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      setImageUrl(dataUrl)
    } catch (error) {
      console.error('[TripDriver image picker]', error)
    } finally {
      event.target.value = ''
    }
  }

  return (
    <RoleScaffold
      title="Tạo xe mới"
      subtitle=""
      bottomNav={<OwnerBottomNav />}
      headerAction={
        <button className="secondary-button" onClick={() => void state.refreshData()} type="button">
          Làm mới
        </button>
      }
      body={
        <div className="page-stack">
          <Card className="preview-card">
            <div className="preview-card-header">
              <div>
                <h3>Xem trước tin đăng</h3>
                <p className="muted">
                </p>
              </div>
            </div>
            <div className="listing-preview">
              <div className="listing-preview-image">
                {imageUrl ? <img alt={name} src={imageUrl} /> : <div className="image-fallback">Ảnh xe</div>}
              </div>
              <div className="listing-preview-content">
                <strong>{name}</strong>
                <span className="muted">{location}</span>
                <span>
                  {seats} chỗ | {transmission} | {fuel}
                </span>
                <strong className="price-text">{money(Number.parseInt(pricePerDay, 10) || 0)}</strong>
                <p className="muted">{description || 'Mô tả của bạn sẽ hiển thị ở đây.'}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h3>Thông tin xe</h3>
            <div className="field-group">
              <span>Hình ảnh xe</span>
              <div className="image-upload-box">
                {imageUrl ? (
                  <img className="image-upload-preview" alt="Xem trước ảnh xe" src={imageUrl} />
                ) : (
                  <div className="image-upload-empty">
                    <div className="image-upload-icon">
                      <ProfileFieldIcon kind="image" />
                    </div>
                    <p>Chọn một ảnh rõ phần đầu hoặc góc nghiêng của xe</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                accept="image/*"
                className="hidden-file-input"
                onChange={(event) => void handleImageSelected(event)}
                type="file"
              />
              <button
                className="secondary-button"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                Chọn ảnh từ thiết bị
              </button>
            </div>

            <label className="field-group">
              <span>Tên hiển thị</span>
              <input readOnly value={name} />
            </label>

            <div className="split-row">
              <label className="field-group">
                <span>Hãng xe</span>
                <select value={brand} onChange={(event) => setBrand(event.target.value)}>
                  {Object.keys(BRAND_MODELS).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span>Dòng xe</span>
                <select value={model} onChange={(event) => setModel(event.target.value)}>
                  {models.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="split-row">
              <label className="field-group">
                <span>Năm sản xuất</span>
                <input value={year} onChange={(event) => setYear(event.target.value)} inputMode="numeric" placeholder="2023" />
              </label>
              <label className="field-group">
                <span>Thành phố</span>
                <input readOnly value={city} />
              </label>
            </div>

            <div className="split-row">
              <label className="field-group">
                <span>Quận / khu vực</span>
                <select value={district} onChange={(event) => setDistrict(event.target.value)}>
                  {districts.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span>Số chỗ</span>
                <select value={seats} onChange={(event) => setSeats(event.target.value)}>
                  {SEAT_OPTIONS.map((item) => (
                    <option key={item} value={String(item)}>
                      {item} chỗ
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="split-row">
              <label className="field-group">
                <span>Nhiên liệu</span>
                <select value={fuel} onChange={(event) => setFuel(event.target.value)}>
                  {FUEL_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-group">
                <span>Hộp số</span>
                <select value={transmission} onChange={(event) => setTransmission(event.target.value)}>
                  {TRANSMISSION_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="split-row">
              <label className="field-group">
                <span>Giá thuê / ngày</span>
                <input
                  value={pricePerDay}
                  onChange={(event) => setPricePerDay(event.target.value.replace(/\D/g, ''))}
                  inputMode="numeric"
                  placeholder="400000"
                />
              </label>
              <label className="field-group">
                <span>Cọc</span>
                <input readOnly value="20%" />
              </label>
            </div>

            <label className="field-group">
              <span>Mô tả xe</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="Ví dụ: Xe phù hợp đi trong thành phố, nội thất gọn gàng, phù hợp cho nhu cầu đi lại hằng ngày."
              />
            </label>

            <label className="checkbox-row">
              <input checked={activeNow} onChange={(event) => setActiveNow(event.target.checked)} type="checkbox" />
              <span>Mở thuê ngay sau khi tạo</span>
            </label>
          </Card>

          <button
            className="primary-button"
            onClick={() =>
              void state.createCar({
                name,
                brand,
                model,
                year: Number.parseInt(year, 10) || 2023,
                location,
                seats: Number.parseInt(seats, 10) || 5,
                transmission,
                fuel,
                pricePerDay: Number.parseInt(pricePerDay, 10) || 0,
                description,
                imageUrl,
                activeNow,
              })
            }
            type="button"
          >
            Tạo xe
          </button>
        </div>
      }
    />
  )
}

export function OwnerBookingsPage() {
  const state = useTripDriver()
  const bookings = state.ownerVisibleBookings()

  return (
    <RoleScaffold
      title="Đơn thuê của tôi"
      subtitle="Chỉ các đơn đã qua bước gửi cọc mới hiển thị cho chủ xe"
      bottomNav={<OwnerBottomNav />}
      headerAction={
        <button className="secondary-button" onClick={() => void state.refreshData()} type="button">
          Làm mới
        </button>
      }
      body={
        <div className="page-stack">
          {bookings.map((booking) => {
            const car = state.carById(booking.carId)
            return (
              <BookingCard
                key={booking.id}
                booking={booking}
                car={car}
                statusLabel={state.bookingStatusLabel(booking.status)}
                ownerLabel={`Người thuê: ${state.profileById(booking.customerId).fullName}`}
                onClick={() => state.openBooking(booking.id, AppPage.ownerBookingDetail)}
              />
            )
          })}
        </div>
      }
    />
  )
}

export function OwnerBookingDetailPage() {
  const state = useTripDriver()
  const booking = state.selectedBooking
  if (!booking) {
    return null
  }
  const renter = state.profileById(booking.customerId)
  const car = state.carById(booking.carId)
  const depositVerified =
    booking.status !== BookingStatus.pendingDeposit &&
    booking.status !== BookingStatus.pendingAdminPaymentReview

  return (
    <RoleScaffold
      title="Chi tiết đơn thuê"
      subtitle={booking.code}
      onBack={() => state.goTo(AppPage.ownerBookings, { bookingId: booking.id })}
      headerAction={
        <button
          className="secondary-button"
          onClick={() => void state.refreshData()}
          type="button"
        >
          Làm mới
        </button>
      }
      body={
        <div className="page-stack">
          <BookingCard
            booking={booking}
            car={car}
            statusLabel={state.bookingStatusLabel(booking.status)}
            ownerLabel={`Người thuê: ${renter.fullName}`}
          />
          <Card>
            <h3>Thông tin người thuê</h3>
            <KeyValueRow label="Họ tên" value={renter.fullName} />
            <KeyValueRow label="Số điện thoại" value={renter.phone} />
            <KeyValueRow
              label="Đã xác nhận cọc"
              value={depositVerified ? 'Có' : 'Chưa'}
            />
            <KeyValueRow label="Phí nền tảng" value={money(booking.platformFeeAmount)} />
            <KeyValueRow label="Chủ xe thực nhận" value={money(booking.ownerPayoutAmount)} />
          </Card>
          {booking.status === BookingStatus.pendingOwnerConfirmation ? (
            <>
              <button className="primary-button" onClick={() => void state.ownerConfirmBooking(booking.id)} type="button">
                Chấp nhận đơn
              </button>
              <button className="danger-button" onClick={() => void state.ownerRejectBooking(booking.id)} type="button">
                Từ chối đơn
              </button>
            </>
          ) : null}
          {booking.status === BookingStatus.pendingOwnerCompletion ? (
            <button className="primary-button" onClick={() => void state.ownerCompleteTrip(booking.id)} type="button">
              Hoàn thành chuyến
            </button>
          ) : null}
          {booking.status === BookingStatus.inProgress ? (
            <Card>
              <p>Người thuê chưa bấm Hoàn tất trả xe. Nút Hoàn thành chuyến chỉ mở sau khi người thuê xác nhận đã trả xe.</p>
            </Card>
          ) : null}
        </div>
      }
    />
  )
}


