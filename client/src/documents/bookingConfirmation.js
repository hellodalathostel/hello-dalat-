import { buildDocument } from '../templates/baseDocument'
import { hostelConfig } from '../constants/hostelConfig'
import { openDocumentPopup } from '../utils/documentPopup'
import { formatVND } from '../utils/formatVND'
import { buildLineItems, calcTotals } from '../utils/buildLineItems.js'
import {
  escapeHtml,
  formatDate,
  getBookingCode,
  getDepositPaid,
  getGuestCount,
  getGuestName,
  getNights,
  getPaymentMethod,
  getRoomNumber,
  getRoomType,
  getSource,
  renderHeader,
} from './common'

function renderInfoItem(labelEn, labelVi, value) {
  return `
    <div class="info-item">
      <div class="label-en">${escapeHtml(labelEn)}</div>
      <div class="label-vi">${escapeHtml(labelVi)}</div>
      <div class="value">${escapeHtml(value)}</div>
    </div>
  `
}

function renderTableHeaderCell(labelEn, labelVi, extraStyle = '') {
  return `
    <th${extraStyle ? ` style="${extraStyle}"` : ''}>
      <span class="th-en">${escapeHtml(labelEn)}</span>
      <span class="th-vi">${escapeHtml(labelVi)}</span>
    </th>
  `
}

function renderBoxTitle(labelEn, labelVi, color = '') {
  const style = color ? ` style="color: ${color};"` : ''
  return `<div class="box-title"${style}>${escapeHtml(labelEn)}<span class="box-title-vi">${escapeHtml(labelVi)}</span></div>`
}

function renderBilingualNote(noteEn, noteVi) {
  return `<li>${escapeHtml(noteEn)}<span class="vi-note">${escapeHtml(noteVi)}</span></li>`
}

function renderFooter() {
  return `
    <div class="doc-footer">
      <span class="footer-en">Thank you for choosing Hello Dalat Hostel!</span>
      <span class="vi-note">Cảm ơn quý khách đã tin tưởng Hello Dalat Hostel!</span>
    </div>
  `
}

export function buildBookingConfirmationHtml(reservation) {
  // FULL RESERVATION sample shape (runtime):
  // {
  //   "id": "booking-id",
  //   "services": [{ "name": "Scooter Rental", "quantity": 1, "unitPrice": 130000, "total": 130000 }],
  //   "discounts": [{ "name": "Promo", "amount": 50000 }],
  //   "depositPaid": 200000
  // }
  const bookingCode = getBookingCode(reservation)
  const lineItems = buildLineItems(reservation)
  const paymentMethod = getPaymentMethod(reservation)
  const depositPaid = getDepositPaid(reservation)
  const { subtotal } = calcTotals(lineItems, paymentMethod, depositPaid)
  const balanceDue = subtotal - depositPaid
  const guestName = getGuestName(reservation)
  const guestCount = getGuestCount(reservation)
  const source = getSource(reservation)
  const roomNumber = getRoomNumber(reservation)
  const roomLabel = reservation.roomType || reservation.reservation?.roomType || reservation.room_type || reservation.reservation?.room_type || getRoomType(roomNumber)
  const roomDisplay = `${roomNumber} – ${roomLabel}`

  const tableRows = lineItems
    .map(
      (item) => `
        <tr class="${item.type === 'discount' ? 'discount-row' : ''}">
          <td style="width: 28%;">
            <div class="label-en">${escapeHtml(item.label_en)}</div>
            <div class="label-vi">${escapeHtml(item.label_vi)}</div>
          </td>
          <td style="width: 47%;">
            <div class="label-en">${escapeHtml(item.detail || '')}</div>
            <div class="label-vi">${escapeHtml(item.detail || '')}</div>
          </td>
          <td class="amount" style="width: 25%;">${formatVND(Math.abs(item.total))}</td>
        </tr>`,
    )
    .join('')

  const bodyHTML = `
    ${renderHeader('BOOKING CONFIRMATION', [], 'Xác nhận đặt phòng')}
    <div class="doc-badge">✓ Confirmed and Secured<br><span class="vi-note" style="color: #d1fae5;">Phòng đã được xác nhận và giữ chỗ</span></div>

    <div class="info-grid">
      ${renderInfoItem('Booking ID', 'Mã đặt phòng', bookingCode)}
      ${renderInfoItem('Room', 'Phòng', roomDisplay)}
      ${renderInfoItem('Guest Name', 'Tên khách', guestName)}
      ${renderInfoItem('Check-in', 'Nhận phòng', formatDate(reservation.checkIn))}
      ${renderInfoItem('No. of Guests', 'Số khách', String(guestCount))}
      ${renderInfoItem('Check-out', 'Trả phòng', formatDate(reservation.checkOut))}
      ${renderInfoItem('Source', 'Nguồn đặt', source)}
      ${renderInfoItem('Nights', 'Số đêm', String(getNights(reservation.checkIn, reservation.checkOut) || 1))}
    </div>

    <table>
      <thead>
        <tr>
          ${renderTableHeaderCell('Services', 'Dịch vụ', 'width: 28%;')}
          ${renderTableHeaderCell('Details', 'Chi tiết', 'width: 47%;')}
          ${renderTableHeaderCell('Amount', 'Thành tiền', 'width: 25%; text-align: right;')}
        </tr>
      </thead>
      <tbody>
        ${tableRows}
        <tr class="total-row">
          <td>
            <div class="label-en">Total</div>
            <div class="label-vi">Tổng cộng</div>
          </td>
          <td></td>
          <td class="amount">${formatVND(subtotal)}</td>
        </tr>
        <tr class="total-row">
          <td>
            <div class="label-en">Deposit Received (-)</div>
            <div class="label-vi">Đã đặt cọc (-)</div>
          </td>
          <td></td>
          <td class="amount">${formatVND(depositPaid)}</td>
        </tr>
        <tr class="due-row">
          <td>
            <div class="label-en">Balance Due</div>
            <div class="label-vi" style="color: #d1fae5;">Còn lại (trả khi check-out)</div>
          </td>
          <td></td>
          <td class="amount">${formatVND(balanceDue)}</td>
        </tr>
      </tbody>
    </table>

    <div class="box">
      ${renderBoxTitle('Check-in Information', 'Thông tin nhận phòng')}
      <ul class="notes-list">
        ${renderBilingualNote(`Address: ${hostelConfig.address}`, `Địa chỉ: ${hostelConfig.address}`)}
        ${renderBilingualNote('Check-in 14:00 | Check-out 12:00', 'Giờ nhận phòng 14:00 | Trả phòng 12:00')}
        ${renderBilingualNote('Please bring your ID or passport at check-in.', 'Vui lòng mang CMND/CCCD/Hộ chiếu khi nhận phòng.')}
        ${renderBilingualNote(`Contact: ${hostelConfig.phone}`, `Liên hệ: ${hostelConfig.phone}`)}
      </ul>
    </div>

    ${String(reservation.source ?? '').toLowerCase() === 'booking.com' ? `<p style="margin-bottom: 12px; font-size: 12px; color: #6b7280;">Auto-imported from Booking.com iCal<span class="vi-note">Tự động đồng bộ từ Booking.com iCal</span></p>` : ''}

    ${renderFooter()}
  `

  return buildDocument(`Booking Confirmation ${bookingCode}`, bodyHTML)
}

export function openBookingConfirmation(reservation) {
  console.log('FULL RESERVATION:', JSON.stringify(reservation, null, 2))
  openDocumentPopup(buildBookingConfirmationHtml(reservation))
}