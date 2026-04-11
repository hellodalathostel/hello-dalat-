import { buildDocument } from '../templates/baseDocument'
import { hostelConfig } from '../constants/hostelConfig'
import { openDocumentPopup } from '../utils/documentPopup'
import { formatVND } from '../utils/formatVND'
import { buildLineItems, calcTotals } from '../utils/buildLineItems.js'
import {
  buildVietQrUrl,
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

function renderBankRow(labelEn, labelVi, value, emphasize = false) {
  return `
    <div class="info-item">
      <div class="label-en">${escapeHtml(labelEn)}${emphasize ? ':' : ''}</div>
      <div class="label-vi">${escapeHtml(labelVi)}</div>
      <div class="value">${escapeHtml(value)}</div>
    </div>
  `
}

function renderFooter() {
  return `
    <div class="doc-footer">
      <span class="footer-en">Thank you for choosing Hello Dalat Hostel!</span>
      <span class="vi-note">Cảm ơn quý khách đã tin tưởng Hello Dalat Hostel!</span>
    </div>
  `
}

export function buildDepositRequestHtml(reservation) {
  // FULL RESERVATION sample shape (runtime):
  // {
  //   "id": "booking-id",
  //   "roomRate": 450000,
  //   "services": [{ "name": "Laundry", "quantity": 2, "unitPrice": 50000, "total": 100000 }],
  //   "discount": 50000,
  //   "discountNote": "Loyalty"
  // }
  const bookingCode = getBookingCode(reservation)
  const guestName = getGuestName(reservation)
  const lineItems = buildLineItems(reservation)
  const paymentMethod = getPaymentMethod(reservation)
  const depositPaid = getDepositPaid(reservation)
  const { subtotal } = calcTotals(lineItems, paymentMethod, depositPaid)
  const depositAmount = depositPaid > 0 ? depositPaid : subtotal
  const guestCount = getGuestCount(reservation)
  const roomNumber = getRoomNumber(reservation)
  const roomLabel = reservation.roomType || reservation.reservation?.roomType || reservation.room_type || reservation.reservation?.room_type || getRoomType(roomNumber)
  const roomDisplay = `${roomNumber} – ${roomLabel}`
  const source = getSource(reservation)
  const nights = getNights(reservation.checkIn, reservation.checkOut)
  const transferNote = `COC ${bookingCode} ${guestName}`
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
    ${renderHeader('ROOM DEPOSIT REQUEST', [], 'Yêu cầu đặt cọc giữ phòng')}

    <div class="info-grid">
      ${renderInfoItem('Booking ID', 'Mã đặt phòng', bookingCode)}
      ${renderInfoItem('Room', 'Phòng', roomDisplay)}
      ${renderInfoItem('Guest Name', 'Tên khách', guestName)}
      ${renderInfoItem('Check-in', 'Nhận phòng', formatDate(reservation.checkIn))}
      ${renderInfoItem('No. of Guests', 'Số khách', String(guestCount))}
      ${renderInfoItem('Check-out', 'Trả phòng', formatDate(reservation.checkOut))}
      ${renderInfoItem('Source', 'Nguồn đặt', source)}
      ${renderInfoItem('Nights', 'Số đêm', String(nights || 1))}
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
      </tbody>
    </table>

    <div class="box deposit-highlight">
      ${renderBoxTitle('Deposit Required', 'Số tiền cọc yêu cầu')}
      <div class="deposit-amount">${formatVND(depositAmount)} VND</div>
      <p style="margin-top: 8px; color: #166534;">
        This deposit will be deducted from the final bill at check-out.
        <span class="vi-note" style="color: #166534;">Số tiền cọc sẽ được trừ vào tổng hóa đơn khi trả phòng.</span>
      </p>
    </div>

    <div class="box bank">
      <div style="flex: 1; min-width: 0;">
        ${renderBoxTitle('Bank Transfer Information', 'Thông tin chuyển khoản')}
        ${renderBankRow('Bank', 'Ngân hàng', hostelConfig.bank_name)}
        ${renderBankRow('Account Number', 'Số tài khoản', hostelConfig.bank_account)}
        ${renderBankRow('Account Holder', 'Chủ tài khoản', hostelConfig.bank_owner)}
        ${renderBankRow('Amount', 'Số tiền', `${formatVND(depositAmount)} VND`)}
        ${renderBankRow('Transfer Note', 'Nội dung CK', transferNote, true)}
      </div>
      <div style="width: 232px; flex: 0 0 232px; text-align: right;">
        <img src="${buildVietQrUrl(depositAmount, transferNote)}" alt="QR" style="width: 220px; height: 220px; object-fit: contain;">
      </div>
    </div>

    <div class="box">
      ${renderBoxTitle('Important Notes', 'Lưu ý quan trọng')}
      <ul class="notes-list">
        ${renderBilingualNote('Please complete the transfer within 24 hours to secure the room.', 'Vui lòng chuyển khoản trong vòng 24 giờ để giữ phòng.')}
        ${renderBilingualNote('After payment, please send the transfer receipt to the hostel.', 'Sau khi chuyển khoản, vui lòng gửi biên lai cho hostel.')}
      </ul>
    </div>

    <div class="box warning">
      ${renderBoxTitle('Cancellation Policy', 'Chính sách hủy phòng', '#b45309')}
      <ul class="notes-list">
        ${renderBilingualNote(hostelConfig.cancellation_policy_en, hostelConfig.cancellation_policy_vi)}
      </ul>
    </div>

    ${renderFooter()}
  `

  return buildDocument(`Deposit Request ${bookingCode}`, bodyHTML)
}

export function openDepositRequest(reservation) {
  console.log('FULL RESERVATION:', JSON.stringify(reservation, null, 2))
  openDocumentPopup(buildDepositRequestHtml(reservation))
}