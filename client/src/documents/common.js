import { hostelConfig } from '../constants/hostelConfig'
import { formatVND } from '../utils/formatVND'

export const OTA_SOURCES = new Set(['booking.com', 'agoda', 'airbnb', 'expedia'])
export const BREAKFAST_PRICE = 50000
export const EXTRA_CHECK_FEE = 100000
const ROOM_TYPE_BY_ROOM_NUMBER = {
  '101': 'Family Room',
  '102': 'Single',
  '202': 'Single',
  '301': 'Standard Double',
  '302': 'Standard Double',
  '103': 'Deluxe Double',
  '203': 'Deluxe Double',
  '201': 'Deluxe Queen',
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function getLang(source) {
  return OTA_SOURCES.has(String(source ?? '').toLowerCase()) ? 'en' : 'vi'
}

export function t(lang, vi, en) {
  return lang === 'en' ? `${en} / ${vi}` : vi
}

export function formatDate(dateStr) {
  if (!dateStr) {
    return ''
  }

  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return String(dateStr)
  }

  return date.toLocaleDateString('en-GB')
}

export function getBookingCode(reservation) {
  const rawCode = reservation.code || reservation.id || reservation.bookingId || ''
  const code = String(rawCode)
  return code ? code.slice(0, 6).toUpperCase() : '-'
}

export function getGuestName(reservation) {
  return reservation.guest_name || reservation.guestName || reservation.name || 'Guest'
}

export function getGuestCount(reservation) {
  const guestLength = Array.isArray(reservation.guests) ? reservation.guests.length : 0
  const adults = Number(reservation.adults ?? 0)
  const children = Number(reservation.children ?? 0)
  return guestLength || Math.max(1, adults + children || 1)
}

export function getRoomNumber(reservation) {
  return reservation.room_number || reservation.roomId || reservation.room_id || '-'
}

export function getRoomType(reservation) {
  if (reservation && typeof reservation === 'object') {
    const explicitRoomType = reservation.reservation?.room_type || reservation.room_type || reservation.roomType
    if (explicitRoomType) {
      return explicitRoomType
    }

    const roomNumber = getRoomNumber(reservation)
    return ROOM_TYPE_BY_ROOM_NUMBER[String(roomNumber)] || 'Standard Room'
  }

  return ROOM_TYPE_BY_ROOM_NUMBER[String(reservation)] || 'Standard Room'
}

export function getNights(checkIn, checkOut) {
  const inDate = new Date(`${checkIn}T00:00:00`)
  const outDate = new Date(`${checkOut}T00:00:00`)
  const diff = Math.round((outDate.getTime() - inDate.getTime()) / 86400000)
  return diff > 0 ? diff : 1
}

export function getDepositPaid(reservation) {
  return Math.max(0, Number(reservation.depositPaid ?? reservation.deposit_paid ?? 0) || 0)
}

export function getRoomRate(reservation) {
  return Math.max(0, Number(reservation.roomRate ?? reservation.room_rate ?? 0) || 0)
}

export function getSource(reservation) {
  return reservation.source || reservation.channel || 'Direct'
}

export function getPaymentMethod(reservation, invoice) {
  return invoice?.paymentMethod || invoice?.payment_method || reservation.paymentMethod || reservation.payment_method || 'cash'
}

export function getPaymentMethodLabel(lang, method) {
  if (method === 'card') {
    return t(lang, 'The (phi 4%)', 'Credit Card (4% fee applies)')
  }

  if (method === 'transfer') {
    return t(lang, 'Chuyen khoan', 'Bank Transfer')
  }

  return t(lang, 'Tien mat', 'Cash')
}

export function getChargeRows(reservation) {
  const nights = getNights(reservation.checkIn, reservation.checkOut)
  const guestCount = getGuestCount(reservation)
  const roomRate = getRoomRate(reservation)
  const breakfastPax = reservation.breakfastIncluded || reservation.breakfast_included ? guestCount : 0
  const roomTotal = nights * roomRate
  const breakfastTotal = breakfastPax * nights * BREAKFAST_PRICE
  const rows = [
    {
      key: 'room',
      description: 'Room Rate',
      descriptionVi: 'Tien phong',
      details: `${nights} nights x ${formatVND(roomRate)}`,
      detailsVi: `${nights} dem x ${formatVND(roomRate)}`,
      amount: roomTotal,
    },
    {
      key: 'breakfast',
      description: 'Breakfast',
      descriptionVi: 'Diem tam',
      details: `${breakfastPax} pax x ${nights} nights x ${formatVND(BREAKFAST_PRICE)}`,
      detailsVi: `${breakfastPax} khach x ${nights} dem x ${formatVND(BREAKFAST_PRICE)}`,
      amount: breakfastTotal,
    },
  ]

  if (reservation.earlyCheckin) {
    rows.push({
      key: 'early',
      description: 'Early Check-in',
      descriptionVi: 'Nhan phong som',
      details: '1 x 100.000',
      detailsVi: '1 lan x 100.000',
      amount: EXTRA_CHECK_FEE,
    })
  }

  if (reservation.lateCheckout) {
    rows.push({
      key: 'late',
      description: 'Late Check-out',
      descriptionVi: 'Tra phong muon',
      details: '1 x 100.000',
      detailsVi: '1 lan x 100.000',
      amount: EXTRA_CHECK_FEE,
    })
  }

  const total = rows.reduce((sum, row) => sum + row.amount, 0)

  return {
    nights,
    guestCount,
    rows,
    total,
  }
}

export function getInvoiceLineItems(reservation, invoice) {
  const inputItems = Array.isArray(invoice?.lineItems)
    ? invoice.lineItems
    : Array.isArray(invoice?.line_items)
      ? invoice.line_items
      : []

  const items = inputItems.map((item) => ({
    description: item.description || item.name || '',
    quantity: Number(item.quantity ?? 0) || 0,
    unitPrice: Number(item.unitPrice ?? item.unit_price ?? 0) || 0,
    total: Number(item.total ?? 0) || (Number(item.quantity ?? 0) || 0) * (Number(item.unitPrice ?? item.unit_price ?? 0) || 0),
  }))

  const hasRoomRate = items.some((item) => item.description.trim().toLowerCase() === 'room rate' || item.description.trim().toLowerCase() === 'tien phong')
  const hasBreakfast = items.some((item) => item.description.trim().toLowerCase() === 'breakfast')
  const nights = getNights(reservation.checkIn, reservation.checkOut)

  if (!hasRoomRate) {
    items.unshift({
      description: 'Room Rate',
      quantity: nights,
      unitPrice: getRoomRate(reservation),
      total: nights * getRoomRate(reservation),
    })
  }

  if (!hasBreakfast) {
    const breakfastPax = reservation.breakfastIncluded || reservation.breakfast_included ? getGuestCount(reservation) : 0
    items.splice(1, 0, {
      description: 'Breakfast',
      quantity: breakfastPax ? nights : 0,
      unitPrice: BREAKFAST_PRICE,
      total: breakfastPax * nights * BREAKFAST_PRICE,
    })
  }

  return items
}

export function buildVietQrUrl(amount, note) {
  const bankId = 'VCB'
  const accountName = encodeURIComponent(hostelConfig.bank_owner)
  const addInfo = encodeURIComponent(note)
  return `https://img.vietqr.io/image/${bankId}-${hostelConfig.bank_account}-compact2.png?amount=${amount}&addInfo=${addInfo}&accountName=${accountName}`
}

export function renderHeader(title, metaLines = [], subtitle = '') {
  return `
    <header>
      <div class="hostel-name">${escapeHtml(hostelConfig.name)}</div>
      <div class="hostel-meta">${escapeHtml(hostelConfig.address)}</div>
      <div class="hostel-meta">${escapeHtml(hostelConfig.phone)} | ${escapeHtml(hostelConfig.email)}</div>
      ${metaLines.map((line) => `<div class="hostel-meta">${escapeHtml(line)}</div>`).join('')}
      <hr class="divider">
      <div class="doc-title">${escapeHtml(title)}</div>
      ${subtitle ? `<div class="doc-title-vi">${escapeHtml(subtitle)}</div>` : ''}
    </header>
  `
}

export function renderInfoGrid(reservation, lang, options = {}) {
  const bookingCode = getBookingCode(reservation)
  const guestName = getGuestName(reservation)
  const guestCount = getGuestCount(reservation)
  const source = getSource(reservation)
  const nights = getNights(reservation.checkIn, reservation.checkOut)
  const roomLine = options.roomLine || `${getRoomNumber(reservation)} (${getRoomType(reservation)})`
  const rightThird = options.rightThird || `${t(lang, 'Check-out', 'Check-out')}: ${formatDate(reservation.checkOut)}`
  const rightFourth = options.rightFourth || `${t(lang, 'So dem', 'Nights')}: ${nights}`

  return `
    <div class="info-grid">
      <div><span>${escapeHtml(t(lang, 'Ma dat phong', 'Booking ID'))}:</span> ${escapeHtml(bookingCode)}</div>
      <div><span>${escapeHtml(t(lang, 'Phong', 'Room'))}:</span> ${escapeHtml(roomLine)}</div>
      <div><span>${escapeHtml(t(lang, 'Ten khach', 'Guest Name'))}:</span> ${escapeHtml(guestName)}</div>
      <div><span>${escapeHtml(t(lang, 'Nhan phong', 'Check-in'))}:</span> ${escapeHtml(formatDate(reservation.checkIn))}</div>
      <div><span>${escapeHtml(t(lang, 'So khach', 'No. of Guests'))}:</span> ${escapeHtml(String(guestCount))}</div>
      <div>${escapeHtml(rightThird)}</div>
      <div><span>${escapeHtml(t(lang, 'Nguon dat', 'Source'))}:</span> ${escapeHtml(source)}</div>
      <div>${escapeHtml(rightFourth)}</div>
    </div>
  `
}

export function renderBankBox(lang, amount, transferNote) {
  return `
    <div class="box bank">
      <div style="flex: 1; min-width: 0;">
        <div class="box-title">${escapeHtml(t(lang, 'Thong tin chuyen khoan', 'Bank Transfer Information'))}</div>
        <p>${escapeHtml(t(lang, 'Ngan hang', 'Bank'))}: ${escapeHtml(hostelConfig.bank_name)}</p>
        <p>${escapeHtml(t(lang, 'So tai khoan', 'Account Number'))}: ${escapeHtml(hostelConfig.bank_account)}</p>
        <p>${escapeHtml(t(lang, 'Chu tai khoan', 'Account Holder'))}: ${escapeHtml(hostelConfig.bank_owner)}</p>
        <p>${escapeHtml(t(lang, 'So tien', 'Amount'))}: ${formatVND(amount)} VND</p>
        <p><strong>${escapeHtml(t(lang, 'Noi dung CK', 'Transfer note'))}:</strong> ${escapeHtml(transferNote)}</p>
      </div>
      <div style="width: 144px; flex: 0 0 144px; text-align: right;">
        <img src="${buildVietQrUrl(amount, transferNote)}" alt="QR" style="width: 128px; height: 128px; object-fit: contain;">
      </div>
    </div>
  `
}

export function renderFooter(lang, viText, enText) {
  return `<div class="doc-footer">${escapeHtml(t(lang, viText, enText))}</div>`
}