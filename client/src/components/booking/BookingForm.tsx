import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../../firebase'
import { ensureRevenueItemsForBooking } from '../../services/revenueSync'
import type { Booking, ServiceItem } from '../../types'

const roomOptions = [
  { value: '101', label: '101 - Family' },
  { value: '102', label: '102 - Single' },
  { value: '202', label: '202 - Single' },
  { value: '103', label: '103 - Deluxe Double' },
  { value: '203', label: '203 - Deluxe Double' },
  { value: '201', label: '201 - Deluxe Queen' },
  { value: '301', label: '301 - Standard Double' },
  { value: '302', label: '302 - Standard Double' },
] as const

const roomRateByRoomId: Record<string, number> = {
  '101': 450000,
  '102': 180000,
  '202': 180000,
  '301': 250000,
  '302': 250000,
  '103': 300000,
  '203': 300000,
  '201': 400000,
}

const sourceSuggestions = [
  'Booking.com',
  'Airbnb',
  'Agoda',
  'Expedia',
  'Zalo',
  'Facebook',
  'Instagram',
  'Walk-in',
  'Friend referral',
  'Direct call',
  'Other',
] as const

const SERVICE_PRESETS = [
  { name: 'Mineral Water 1.5L', unitPrice: 15000 },
  { name: 'Mineral Water 0.5L', unitPrice: 10000 },
  { name: 'Coke', unitPrice: 20000 },
  { name: 'Instant Noodle', unitPrice: 15000 },
  { name: 'Breakfast', unitPrice: 35000 },
  { name: 'Scooter Rental', unitPrice: 130000 },
  { name: 'Laundry', unitPrice: 50000 },
  { name: 'Tour', unitPrice: 0 },
  { name: 'Airport Transfer', unitPrice: 0 },
  { name: 'Late Check-out', unitPrice: 100000 },
  { name: 'Early Check-in', unitPrice: 100000 },
  { name: 'Extra Bed', unitPrice: 150000 },
  { name: 'Other', unitPrice: 0 },
] as const

interface BookingFormProps {
  booking?: Booking
  defaultRoomId?: string
  defaultDate?: string
  onClose: () => void
  onSaved: () => void
}

interface BookingFormState {
  roomId: string
  source: string
  guestName: string
  guestPhone: string
  guestEmail: string
  nationality: string
  checkIn: string
  checkOut: string
  earlyCheckin: boolean
  lateCheckout: boolean
  adults: number
  children: number
  roomRate: number
  totalAmount: number
  services: ServiceItem[]
  discount: number
  discountNote: string
  depositPaid: number
  paymentMethod: Booking['paymentMethod']
  status: Booking['status']
  breakfastIncluded: boolean
  notes: string
}

function toVnd(value: number) {
  return `${value.toLocaleString('vi-VN')} đ`
}

function createServiceItem(): ServiceItem {
  return {
    id: `${Date.now().toString()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    quantity: 1,
    unitPrice: 0,
    total: 0,
  }
}

function recalculateService(service: ServiceItem): ServiceItem {
  const quantity = Math.max(1, Number(service.quantity) || 1)
  const unitPrice = Math.max(0, Number(service.unitPrice) || 0)

  return {
    ...service,
    quantity,
    unitPrice,
    total: quantity * unitPrice,
  }
}

function getNights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) {
    return 0
  }

  const nights = differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn))
  return Number.isNaN(nights) ? 0 : nights
}

function getPaymentStatus(
  depositPaid: number,
  totalAmount: number,
): Booking['paymentStatus'] {
  if (depositPaid <= 0) {
    return 'pending'
  }

  if (depositPaid < totalAmount) {
    return 'partial'
  }

  return 'paid'
}

function getInitialFormState(
  booking?: Booking,
  defaultRoomId?: string,
  defaultDate?: string,
): BookingFormState {
  if (booking) {
    return {
      roomId: booking.roomId,
      source: booking.source,
      guestName: booking.guestName,
      guestPhone: booking.guestPhone,
      guestEmail: booking.guestEmail,
      nationality: booking.nationality,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      earlyCheckin: booking.earlyCheckin ?? false,
      lateCheckout: booking.lateCheckout ?? false,
      adults: booking.adults,
      children: booking.children,
      roomRate: booking.roomRate,
      totalAmount: booking.totalAmount,
      services: (booking.services ?? []).map((service) =>
        recalculateService({
          id: service.id,
          name: service.name,
          quantity: service.quantity,
          unitPrice: service.unitPrice,
          total: service.total,
        }),
      ),
      discount: Math.max(0, Number(booking.discount ?? 0) || 0),
      discountNote: booking.discountNote ?? '',
      depositPaid: booking.depositPaid,
      paymentMethod: booking.paymentMethod,
      status: booking.status,
      breakfastIncluded: booking.breakfastIncluded,
      notes: booking.notes,
    }
  }

  const initialRoomId = defaultRoomId ?? '101'
  const initialRate = roomRateByRoomId[initialRoomId] ?? 0
  const checkIn = defaultDate ?? format(new Date(), 'yyyy-MM-dd')
  const checkOut = format(addDays(parseISO(checkIn), 1), 'yyyy-MM-dd')

  return {
    roomId: initialRoomId,
    source: 'Direct call',
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    nationality: 'VN',
    checkIn,
    checkOut,
    earlyCheckin: false,
    lateCheckout: false,
    adults: 1,
    children: 0,
    roomRate: initialRate,
    totalAmount: initialRate,
    services: [],
    discount: 0,
    discountNote: '',
    depositPaid: 0,
    paymentMethod: 'cash',
    status: 'confirmed',
    breakfastIncluded: false,
    notes: '',
  }
}

export default function BookingForm({
  booking,
  defaultRoomId,
  defaultDate,
  onClose,
  onSaved,
}: BookingFormProps) {
  const [formState, setFormState] = useState<BookingFormState>(() =>
    getInitialFormState(booking, defaultRoomId, defaultDate),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setFormState(getInitialFormState(booking, defaultRoomId, defaultDate))
    setError(null)
  }, [booking, defaultDate, defaultRoomId])

  const nights = useMemo(
    () => getNights(formState.checkIn, formState.checkOut),
    [formState.checkIn, formState.checkOut],
  )

  const paymentStatus = useMemo(
    () => getPaymentStatus(formState.depositPaid, formState.totalAmount),
    [formState.depositPaid, formState.totalAmount],
  )

  const filteredSourceSuggestions = useMemo(() => {
    const keyword = formState.source.trim().toLowerCase()

    if (!keyword) {
      return sourceSuggestions
    }

    return sourceSuggestions.filter((option) =>
      option.toLowerCase().includes(keyword),
    )
  }, [formState.source])

  const servicesTotal = useMemo(
    () =>
      formState.services.reduce((sum, service) => sum + (service.total || 0), 0),
    [formState.services],
  )

  const roomSubtotal = useMemo(
    () => (nights > 0 ? nights * formState.roomRate : formState.roomRate),
    [formState.roomRate, nights],
  )

  const remainingAmount = useMemo(
    () => formState.totalAmount - formState.depositPaid,
    [formState.depositPaid, formState.totalAmount],
  )

  const cardFee = useMemo(
    () => (formState.paymentMethod === 'card' ? remainingAmount * 0.04 : 0),
    [formState.paymentMethod, remainingAmount],
  )

  const grandTotal = useMemo(
    () => remainingAmount + cardFee,
    [cardFee, remainingAmount],
  )

  useEffect(() => {
    const calculatedTotalAmount = Math.max(0, roomSubtotal + servicesTotal - formState.discount)

    setFormState((current) =>
      current.totalAmount === calculatedTotalAmount
        ? current
        : { ...current, totalAmount: calculatedTotalAmount },
    )
  }, [formState.discount, roomSubtotal, servicesTotal])

  function updateState<K extends keyof BookingFormState>(
    key: K,
    value: BookingFormState[K],
  ) {
    setFormState((current) => ({ ...current, [key]: value }))
  }

  function handleRoomChange(roomId: string) {
    const nextRate = roomRateByRoomId[roomId] ?? formState.roomRate

    setFormState((current) => ({
      ...current,
      roomId,
      roomRate: nextRate,
    }))
  }

  function handleDateChange(key: 'checkIn' | 'checkOut', value: string) {
    setFormState((current) => {
      return { ...current, [key]: value }
    })
  }

  function handleServiceChange(
    serviceId: string,
    key: 'name' | 'quantity' | 'unitPrice',
    value: string,
  ) {
    setFormState((current) => {
      const nextServices = current.services.map((service) => {
        if (service.id !== serviceId) {
          return service
        }

        if (key === 'name') {
          const matchedPreset = SERVICE_PRESETS.find(
            (preset) => preset.name.toLowerCase() === value.trim().toLowerCase(),
          )

          return recalculateService({
            ...service,
            name: value,
            unitPrice: matchedPreset ? matchedPreset.unitPrice : service.unitPrice,
          })
        }

        if (key === 'quantity') {
          return recalculateService({
            ...service,
            quantity: Math.max(1, Number(value) || 1),
          })
        }

        return recalculateService({
          ...service,
          unitPrice: Math.max(0, Number(value) || 0),
        })
      })

      return { ...current, services: nextServices }
    })
  }

  function addServiceRow() {
    setFormState((current) => ({
      ...current,
      services: [...current.services, createServiceItem()],
    }))
  }

  function removeServiceRow(serviceId: string) {
    setFormState((current) => ({
      ...current,
      services: current.services.filter((service) => service.id !== serviceId),
    }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!formState.roomId || !formState.guestName.trim() || !formState.checkIn || !formState.checkOut) {
      setError('Vui lòng điền đầy đủ các trường bắt buộc: phòng, tên khách, check-in, check-out.')
      return
    }

    if (nights <= 0) {
      setError('Ngày check-out phải sau ngày check-in.')
      return
    }

    setSubmitting(true)

    try {
      const now = new Date().toISOString()
      const payload = {
        roomId: formState.roomId,
        source: formState.source,
        guestName: formState.guestName.trim(),
        guestPhone: formState.guestPhone.trim(),
        guestEmail: formState.guestEmail.trim(),
        nationality: formState.nationality,
        checkIn: formState.checkIn,
        checkOut: formState.checkOut,
        earlyCheckin: formState.earlyCheckin,
        lateCheckout: formState.lateCheckout,
        nights,
        adults: formState.adults,
        children: formState.children,
        roomRate: formState.roomRate,
        totalAmount: formState.totalAmount,
        services: formState.services.map((service) =>
          recalculateService({
            id: service.id,
            name: service.name.trim(),
            quantity: service.quantity,
            unitPrice: service.unitPrice,
            total: service.total,
          }),
        ),
        discount: formState.discount,
        discountNote: formState.discountNote.trim(),
        depositPaid: formState.depositPaid,
        paymentStatus,
        paymentMethod: formState.paymentMethod,
        breakfastIncluded: formState.breakfastIncluded,
        status: formState.status,
        notes: formState.notes.trim(),
        icalEventId: booking?.icalEventId ?? null,
        updatedAt: now,
      }

      if (booking) {
        await updateDoc(doc(db, 'bookings', booking.id), payload)

        if (payload.status === 'checkedout' || payload.paymentStatus === 'paid') {
          try {
            await ensureRevenueItemsForBooking({
              ...booking,
              ...payload,
              id: booking.id,
            })
          } catch (syncError) {
            console.error(syncError)
            setError('Booking da luu, nhung khong the dong bo doanh thu tu dong.')
          }
        }
      } else {
        const created = await addDoc(collection(db, 'bookings'), {
          ...payload,
          createdAt: now,
        })

        if (payload.status === 'checkedout' || payload.paymentStatus === 'paid') {
          try {
            await ensureRevenueItemsForBooking({
              ...(payload as Omit<Booking, 'id' | 'createdAt'>),
              id: created.id,
              createdAt: now,
            } as Booking)
          } catch (syncError) {
            console.error(syncError)
            setError('Booking da luu, nhung khong the dong bo doanh thu tu dong.')
          }
        }
      }

      onSaved()
      onClose()
    } catch (submitError) {
      console.error(submitError)
      setError('Không thể lưu booking. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 p-4 md:p-6">
      <div className="grid grid-cols-1 gap-4">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Phòng *</span>
          <select
            value={formState.roomId}
            onChange={(event) => handleRoomChange(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            {roomOptions.map((room) => (
              <option key={room.value} value={room.value}>
                {room.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Nguồn</span>
          <input
            type="text"
            value={formState.source}
            onChange={(event) => updateState('source', event.target.value)}
            list="source-suggestions"
            placeholder="Booking.com / Walk-in / Direct call"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <datalist id="source-suggestions">
            {filteredSourceSuggestions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Tên khách *</span>
          <input
            type="text"
            value={formState.guestName}
            onChange={(event) => updateState('guestName', event.target.value)}
            placeholder="Nguyen Van A"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            required
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Điện thoại</span>
          <input
            type="text"
            value={formState.guestPhone}
            onChange={(event) => updateState('guestPhone', event.target.value)}
            placeholder="0901234567"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            value={formState.guestEmail}
            onChange={(event) => updateState('guestEmail', event.target.value)}
            placeholder="guest@example.com"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Quốc tịch</span>
          <select
            value={formState.nationality}
            onChange={(event) => updateState('nationality', event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            <option value="VN">VN (Việt Nam)</option>
            <option value="foreign">foreign (Nước ngoài)</option>
          </select>
        </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Check-in *</span>
            <input
              type="date"
              value={formState.checkIn}
              onChange={(event) => handleDateChange('checkIn', event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              required
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Check-out *</span>
            <input
              type="date"
              value={formState.checkOut}
              onChange={(event) => handleDateChange('checkOut', event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              required
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="rounded-xl border border-slate-200 bg-[#fffdf8] px-3 py-3 text-sm text-slate-700">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={formState.earlyCheckin}
                onChange={(event) => updateState('earlyCheckin', event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <div>
                <div className="font-medium text-slate-800">Early Check-in</div>
                <p className="mt-1 text-xs text-slate-500">
                  Phong se bi block tu dem hom truoc (checkIn - 1 ngay)
                </p>
              </div>
            </div>
          </label>

          <label className="rounded-xl border border-slate-200 bg-[#fffdf8] px-3 py-3 text-sm text-slate-700">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={formState.lateCheckout}
                onChange={(event) => updateState('lateCheckout', event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <div>
                <div className="font-medium text-slate-800">Late Check-out</div>
                <p className="mt-1 text-xs text-slate-500">
                  Phong se bi block ca ngay tra phong
                </p>
              </div>
            </div>
          </label>
        </div>

        <p className="rounded-xl bg-[#faf8f1] px-3 py-2 text-sm text-slate-600">
          Đêm: <span className="font-semibold text-slate-900">{nights}</span>
        </p>

        <div className="grid grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Người lớn</span>
            <input
              type="number"
              min={1}
              value={formState.adults}
              onChange={(event) => updateState('adults', Number(event.target.value) || 1)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Trẻ em</span>
            <input
              type="number"
              min={0}
              value={formState.children}
              onChange={(event) => updateState('children', Math.max(0, Number(event.target.value) || 0))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
        </div>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Giá phòng/đêm (VND)</span>
          <input
            type="number"
            min={0}
            value={formState.roomRate}
            onChange={(event) => {
              const roomRate = Math.max(0, Number(event.target.value) || 0)
              setFormState((current) => ({ ...current, roomRate }))
            }}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <p className="text-xs text-slate-500">{toVnd(formState.roomRate)}</p>
        </label>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-[#fffdf8] p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Dịch vụ kèm theo</h3>
            <button
              type="button"
              onClick={addServiceRow}
              className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/15"
            >
              + Thêm dịch vụ
            </button>
          </div>

          {formState.services.length === 0 ? (
            <p className="text-xs text-slate-500">Chưa có dịch vụ nào</p>
          ) : (
            <div className="space-y-2">
              {formState.services.map((service) => (
                <div
                  key={service.id}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-12"
                >
                  <div className="md:col-span-4">
                    <input
                      type="text"
                      value={service.name}
                      onChange={(event) => {
                        handleServiceChange(service.id, 'name', event.target.value)
                      }}
                      list="service-preset-options"
                      placeholder="Service name"
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="number"
                      min={1}
                      value={service.quantity}
                      onChange={(event) => {
                        handleServiceChange(service.id, 'quantity', event.target.value)
                      }}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <input
                      type="number"
                      min={0}
                      value={service.unitPrice}
                      onChange={(event) => {
                        handleServiceChange(service.id, 'unitPrice', event.target.value)
                      }}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                  </div>
                  <div className="flex items-center justify-between md:col-span-3 md:justify-end md:gap-2">
                    <span className="text-xs font-medium text-slate-700">= {toVnd(service.total)}</span>
                    <button
                      type="button"
                      onClick={() => removeServiceRow(service.id)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-50"
                    >
                      x
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <datalist id="service-preset-options">
            {SERVICE_PRESETS.map((preset) => (
              <option key={preset.name} value={preset.name} />
            ))}
          </datalist>

          <p className="text-sm font-medium text-slate-700">
            Tổng dịch vụ: <span className="font-semibold text-slate-900">{toVnd(servicesTotal)}</span>
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-[#fffdf8] p-3">
          <h3 className="text-sm font-semibold text-slate-800">Giảm giá</h3>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Số tiền giảm (VND)</span>
            <input
              type="number"
              min={0}
              value={formState.discount}
              onChange={(event) => updateState('discount', Math.max(0, Number(event.target.value) || 0))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Ghi chú giảm giá</span>
            <input
              type="text"
              value={formState.discountNote}
              onChange={(event) => updateState('discountNote', event.target.value)}
              placeholder="Ly do giam gia"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
        </section>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Tổng tiền (VND)</span>
          <input
            type="number"
            min={0}
            value={formState.totalAmount}
            readOnly
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />

          <div className="mt-2 rounded-xl border border-slate-200 bg-[#fffdf8] px-3 py-3 text-sm text-slate-700">
            <div className="flex items-center justify-between">
              <span>Tiền phòng:</span>
              <span>{toVnd(roomSubtotal)}</span>
            </div>

            {servicesTotal > 0 ? (
              <div className="mt-1 flex items-center justify-between">
                <span>Dịch vụ:</span>
                <span>{toVnd(servicesTotal)}</span>
              </div>
            ) : null}

            {formState.discount > 0 ? (
              <div className="mt-1 flex items-center justify-between text-red-600">
                <span>Giảm giá:</span>
                <span>-{toVnd(formState.discount)}</span>
              </div>
            ) : null}

            <div className="my-2 border-t border-slate-300" />

            <div className="flex items-center justify-between">
              <span>Tổng cộng:</span>
              <span>{toVnd(formState.totalAmount)}</span>
            </div>

            <div className="mt-1 flex items-center justify-between">
              <span>Đã cọc:</span>
              <span>-{toVnd(formState.depositPaid)}</span>
            </div>

            <div className="mt-1 flex items-center justify-between">
              <span>Còn lại:</span>
              <span>{toVnd(remainingAmount)}</span>
            </div>

            {formState.paymentMethod === 'card' ? (
              <div className="mt-1 flex items-center justify-between">
                <span>Phí thẻ (4%):</span>
                <span>+{toVnd(cardFee)}</span>
              </div>
            ) : null}

            <div className="my-2 border-t border-slate-300" />

            <div className="flex items-center justify-between font-semibold text-primary">
              <span>Khách thanh toán:</span>
              <span>{toVnd(grandTotal)}</span>
            </div>
          </div>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Đặt cọc (VND)</span>
          <input
            type="number"
            min={0}
            value={formState.depositPaid}
            onChange={(event) => updateState('depositPaid', Math.max(0, Number(event.target.value) || 0))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <p className="text-xs text-slate-500">{toVnd(formState.depositPaid)}</p>
        </label>

        <p className="rounded-xl bg-[#faf8f1] px-3 py-2 text-sm text-slate-600">
          Trạng thái thanh toán: <span className="font-semibold text-slate-900">{paymentStatus}</span>
        </p>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Phương thức thanh toán</span>
          <select
            value={formState.paymentMethod}
            onChange={(event) => updateState('paymentMethod', event.target.value as Booking['paymentMethod'])}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            <option value="cash">cash</option>
            <option value="card">card</option>
            <option value="transfer">transfer</option>
            <option value="ota">ota</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Trạng thái</span>
          <select
            value={formState.status}
            onChange={(event) => updateState('status', event.target.value as Booking['status'])}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            <option value="confirmed">confirmed</option>
            <option value="checkedin">checkedin</option>
            <option value="checkedout">checkedout</option>
            <option value="cancelled">cancelled</option>
            <option value="noshow">noshow</option>
          </select>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={formState.breakfastIncluded}
            onChange={(event) => updateState('breakfastIncluded', event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
          />
          <span>Bữa sáng</span>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">Ghi chú</span>
          <textarea
            rows={3}
            value={formState.notes}
            onChange={(event) => updateState('notes', event.target.value)}
            placeholder="Special requests"
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-100 bg-white/90 pt-4 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300"
          disabled={submitting}
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Đang lưu...' : booking ? 'Lưu thay đổi' : 'Tạo booking'}
        </button>
      </div>
    </form>
  )
}