import { formatVND } from './formatVND'

const BREAKFAST_PRICE = 50000
const EXTRA_FEE_DEFAULT = 100000

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function calcNights(reservation) {
  const explicitNights = toNumber(reservation?.nights ?? reservation?.so_dem)
  if (explicitNights > 0) {
    return explicitNights
  }

  const checkIn = reservation?.checkIn || reservation?.check_in
  const checkOut = reservation?.checkOut || reservation?.check_out

  if (!checkIn || !checkOut) {
    return 1
  }

  const inDate = new Date(`${checkIn}T00:00:00`)
  const outDate = new Date(`${checkOut}T00:00:00`)
  const diff = Math.round((outDate.getTime() - inDate.getTime()) / 86400000)
  return diff > 0 ? diff : 1
}

function getRoomRate(reservation) {
  return Math.max(
    0,
    toNumber(
      reservation?.room_rate
      ?? reservation?.roomRate
      ?? reservation?.price
      ?? reservation?.nightly_rate,
    ),
  )
}

function getBreakfastPax(reservation) {
  const directPax = Math.max(
    0,
    toNumber(
      reservation?.breakfast_pax
      ?? reservation?.breakfastPax
      ?? reservation?.breakfast_count
      ?? reservation?.breakfastCount,
    ),
  )

  if (directPax > 0) {
    return directPax
  }

  const breakfastIncluded = Boolean(
    reservation?.breakfastIncluded
    || reservation?.breakfast_included,
  )

  if (!breakfastIncluded) {
    return 0
  }

  const adults = toNumber(reservation?.adults)
  const children = toNumber(reservation?.children)
  const fallbackGuests = Math.max(1, adults + children)

  if (Array.isArray(reservation?.guests) && reservation.guests.length > 0) {
    return reservation.guests.length
  }

  return fallbackGuests
}

function toExtraItem(extra, index) {
  const qty = Math.max(1, toNumber(extra?.qty ?? extra?.quantity ?? 1) || 1)
  const unitPriceRaw = toNumber(extra?.unit_price ?? extra?.unitPrice ?? extra?.price)
  const totalRaw = toNumber(extra?.total ?? extra?.amount)
  const unitPrice = unitPriceRaw > 0 ? unitPriceRaw : totalRaw
  const total = totalRaw !== 0 ? totalRaw : unitPrice * qty

  if (total <= 0) {
    return null
  }

  const labelEn = extra?.name_en || extra?.nameEn || extra?.name || extra?.label || `Extra Service ${index + 1}`
  const labelVi = extra?.name_vi || extra?.nameVi || extra?.label_vi || extra?.labelVi || labelEn
  const detail = extra?.detail || extra?.description || `${qty} x ${formatVND(unitPrice)}`

  return {
    type: 'extra',
    label_en: String(labelEn),
    label_vi: String(labelVi),
    detail: String(detail),
    unit_price: unitPrice,
    qty,
    total,
    sort_order: 10 + index,
  }
}

function toDiscountItem(discount, index) {
  const rawAmount = Math.max(
    0,
    toNumber(
      discount?.amount
      ?? discount?.value
      ?? discount?.total
      ?? discount,
    ),
  )

  if (rawAmount <= 0) {
    return null
  }

  const labelEn = discount?.name_en || discount?.nameEn || discount?.name || 'Discount'
  const labelVi = discount?.name_vi || discount?.nameVi || discount?.label_vi || discount?.labelVi || 'Giảm giá'

  return {
    type: 'discount',
    label_en: String(labelEn),
    label_vi: String(labelVi),
    detail: String(discount?.detail || discount?.description || ''),
    unit_price: -rawAmount,
    qty: 1,
    total: -rawAmount,
    sort_order: 90 + index,
  }
}

export function buildLineItems(reservation = {}) {
  const items = []
  const nights = calcNights(reservation)
  const roomRate = getRoomRate(reservation)

  items.push({
    type: 'room',
    label_en: 'Room Rate',
    label_vi: 'Tiền phòng',
    detail: `${nights} nights x ${formatVND(roomRate)}`,
    unit_price: roomRate,
    qty: nights,
    total: roomRate * nights,
    sort_order: 1,
  })

  const breakfastPax = getBreakfastPax(reservation)
  if (breakfastPax > 0) {
    items.push({
      type: 'breakfast',
      label_en: 'Breakfast',
      label_vi: 'Điểm tâm',
      detail: `${breakfastPax} pax x ${nights} nights x ${formatVND(BREAKFAST_PRICE)}`,
      unit_price: BREAKFAST_PRICE,
      qty: breakfastPax * nights,
      total: BREAKFAST_PRICE * breakfastPax * nights,
      sort_order: 2,
    })
  }

  if (reservation?.earlyCheckin || reservation?.early_checkin) {
    items.push({
      type: 'extra',
      label_en: 'Early Check-in',
      label_vi: 'Nhận phòng sớm',
      detail: `1 x ${formatVND(EXTRA_FEE_DEFAULT)}`,
      unit_price: EXTRA_FEE_DEFAULT,
      qty: 1,
      total: EXTRA_FEE_DEFAULT,
      sort_order: 8,
    })
  }

  if (reservation?.lateCheckout || reservation?.late_checkout) {
    items.push({
      type: 'extra',
      label_en: 'Late Check-out',
      label_vi: 'Trả phòng muộn',
      detail: `1 x ${formatVND(EXTRA_FEE_DEFAULT)}`,
      unit_price: EXTRA_FEE_DEFAULT,
      qty: 1,
      total: EXTRA_FEE_DEFAULT,
      sort_order: 9,
    })
  }

  const extras = reservation?.extra_services
    || reservation?.add_ons
    || reservation?.addOns
    || reservation?.extras
    || reservation?.charges
    || reservation?.booking_items
    || reservation?.services
    || []

  if (Array.isArray(extras)) {
    extras.forEach((extra, index) => {
      const normalized = toExtraItem(extra, index)
      if (normalized) {
        items.push(normalized)
      }
    })
  }

  const discountCandidates = reservation?.discounts
    || reservation?.adjustments
    || reservation?.reservation_discounts
    || reservation?.discountItems
    || []

  if (Array.isArray(discountCandidates)) {
    discountCandidates.forEach((discount, index) => {
      const normalized = toDiscountItem(discount, index)
      if (normalized) {
        items.push(normalized)
      }
    })
  }

  const scalarDiscount = Math.max(
    0,
    toNumber(reservation?.discount_amount ?? reservation?.discount),
  )

  if (scalarDiscount > 0) {
    const discountNote = reservation?.discountNote || reservation?.discount_note || ''
    items.push({
      type: 'discount',
      label_en: 'Discount',
      label_vi: 'Giảm giá',
      detail: String(discountNote),
      unit_price: -scalarDiscount,
      qty: 1,
      total: -scalarDiscount,
      sort_order: 95,
    })
  }

  return items
    .filter((item) => Number(item.total) !== 0)
    .sort((a, b) => a.sort_order - b.sort_order)
}

export function calcTotals(line_items, payment_method, deposit_paid = 0) {
  const subtotal = line_items.reduce((sum, item) => sum + toNumber(item.total), 0)
  const card_fee = payment_method === 'card'
    ? Math.round(subtotal * 0.04)
    : 0
  const total_with_fee = subtotal + card_fee
  const amount_due = total_with_fee - toNumber(deposit_paid)

  return {
    subtotal,
    card_fee,
    total_with_fee,
    amount_due,
  }
}
