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

function renderSummaryRow(labelEn, labelVi, value, className = '') {
  return `
    <div class="summary-row${className ? ` ${className}` : ''}">
      <span>
        <span class="label-en">${escapeHtml(labelEn)}</span>
        <span class="label-vi">${escapeHtml(labelVi)}</span>
      </span>
      <span class="amount">${formatVND(value)}</span>
    </div>
  `
}

function renderBoxTitle(labelEn, labelVi, color = '') {
  const style = color ? ` style="color: ${color};"` : ''
  return `<div class="box-title"${style}>${escapeHtml(labelEn)}<span class="box-title-vi">${escapeHtml(labelVi)}</span></div>`
}

function getPaymentMethodBilingual(method) {
  if (method === 'card') {
    return {
      en: 'Credit Card',
      vi: 'Thẻ tín dụng',
    }
  }

  if (method === 'transfer') {
    return {
      en: 'Bank Transfer',
      vi: 'Chuyển khoản',
    }
  }

  return {
    en: 'Cash',
    vi: 'Tiền mặt',
  }
}

function renderFooter() {
  return `
    <div class="doc-footer">
      <span class="footer-en">Thank you for your stay!</span>
      <span class="vi-note">Cảm ơn quý khách đã sử dụng dịch vụ!</span>
    </div>
  `
}

export function buildInvoiceHtml(reservation, invoice) {
  // FULL RESERVATION sample shape (runtime):
  // {
  //   "id": "booking-id",
  //   "services": [{ "name": "Laundry", "quantity": 1, "unitPrice": 50000, "total": 50000 }],
  //   "lineItems": [{ "description": "Tour", "quantity": 1, "unitPrice": 300000, "total": 300000 }],
  //   "discount": 50000,
  //   "discountNote": "Voucher"
  // }
  const invoiceNumber = invoice.invoiceNumber || invoice.number || `INV-${getBookingCode(reservation)}`
  const guestName = invoice.guestName || invoice.guest_name || getGuestName(reservation)
  const nights = getNights(reservation.checkIn, reservation.checkOut)
  const paymentMethod = getPaymentMethod(reservation, invoice)
  const paymentLabel = getPaymentMethodBilingual(paymentMethod)
  const depositPaid = getDepositPaid(reservation)
  // Use invoice's pre-computed line items when available; fallback to buildLineItems for legacy invoices
  const invoiceStoredItems = Array.isArray(invoice?.lineItems) && invoice.lineItems.length > 0
    ? invoice.lineItems
    : null

  const line_items = invoiceStoredItems
    ? invoiceStoredItems
        .map((item, idx) => ({
          type: Number(item.total ?? 0) < 0 ? 'discount' : 'item',
          label_en: item.description || item.name || '',
          label_vi: item.description || item.name || '',
          detail: '',
          unit_price: Number(item.unitPrice ?? item.unit_price ?? 0),
          qty: Number(item.quantity ?? item.qty ?? 1),
          total: Number(item.total ?? 0),
          sort_order: idx,
        }))
        .filter((item) => item.total !== 0)
    : buildLineItems(reservation)
  const { subtotal, card_fee, total_with_fee, amount_due } = calcTotals(line_items, paymentMethod, depositPaid)
  const transferNote = `HOADON ${invoiceNumber} ${guestName}`
  const issueDate = invoice.issueDate || invoice.issue_date || ''
  const roomNumber = getRoomNumber(reservation)
  const roomLabel = reservation.room_type || reservation.reservation?.room_type || getRoomType(roomNumber)
  const roomDisplay = `${roomNumber} – ${roomLabel}`
  const guestCount = getGuestCount(reservation)
  const source = getSource(reservation)

  const tableRows = line_items
    .map(
      (item, index) => `
        <tr class="${item.type === 'discount' ? 'discount-row' : ''}">
          <td class="amount" style="width: 6%;">${index + 1}</td>
          <td style="width: 36%;">
            <div class="label-en">${escapeHtml(item.label_en)}</div>
            <div class="label-vi">${escapeHtml(item.label_vi)}</div>
          </td>
          <td class="amount" style="width: 10%;">${formatVND(Math.abs(item.qty))}</td>
          <td class="amount" style="width: 22%;">${formatVND(Math.abs(item.unit_price))}</td>
          <td class="amount" style="width: 26%;">${formatVND(Math.abs(item.total))}</td>
        </tr>`,
    )
    .join('')

  const watermark = String(invoice.status ?? '').toLowerCase() === 'paid'
    ? `<div class="watermark">PAID<br><span style="font-size: 28px; font-style: italic;">ĐÃ THANH TOÁN</span></div>`
    : ''

  const bodyHTML = `
    ${watermark}
    ${renderHeader('INVOICE', [`Tax ID: ${hostelConfig.tax_id}`], 'Hóa đơn dịch vụ')}
    <div class="info-grid" style="margin-bottom: 16px;">
      ${renderInfoItem('Invoice No.', 'Số hóa đơn', invoiceNumber)}
      ${renderInfoItem('Date', 'Ngày', formatDate(issueDate))}
      ${renderInfoItem('Guest Name', 'Tên khách', guestName)}
      ${renderInfoItem('Source', 'Nguồn đặt', source)}
      ${renderInfoItem('Room', 'Phòng', roomDisplay)}
      ${renderInfoItem('No. of Guests', 'Số khách', String(guestCount))}
      ${renderInfoItem('Check-in', 'Nhận phòng', formatDate(reservation.checkIn))}
      ${renderInfoItem('Check-out', 'Trả phòng', formatDate(reservation.checkOut))}
      ${renderInfoItem('Nights', 'Số đêm', String(nights))}
      ${renderInfoItem('Payment Method', 'Phương thức thanh toán', `${paymentLabel.en} | ${paymentLabel.vi}`)}
    </div>

    <table>
      <thead>
        <tr>
          ${renderTableHeaderCell('No.', 'STT', 'width: 6%;')}
          ${renderTableHeaderCell('Services', 'Dịch vụ', 'width: 36%;')}
          ${renderTableHeaderCell('Qty', 'Số lượng', 'width: 10%; text-align: right;')}
          ${renderTableHeaderCell('Unit Price', 'Đơn giá', 'width: 22%; text-align: right;')}
          ${renderTableHeaderCell('Amount', 'Thành tiền', 'width: 26%; text-align: right;')}
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <div class="summary">
      ${renderSummaryRow('Subtotal', 'Tạm tính', subtotal)}
      ${paymentMethod === 'card' ? renderSummaryRow('Card Fee 4%', 'Phí quẹt thẻ 4%', card_fee) : ''}
      ${renderSummaryRow('Total', 'Tổng cộng', total_with_fee, 'total')}
      ${renderSummaryRow('Deposit (-)', 'Đã đặt cọc (-)', depositPaid)}
      ${renderSummaryRow('AMOUNT DUE', 'SỐ TIỀN THANH TOÁN', amount_due, 'due')}
    </div>

    <div class="box bank">
      <div style="flex: 1; min-width: 0;">
        ${renderBoxTitle('Bank Transfer Information', 'Thông tin chuyển khoản')}
        ${renderInfoItem('Bank', 'Ngân hàng', hostelConfig.bank_name)}
        ${renderInfoItem('Account Number', 'Số tài khoản', hostelConfig.bank_account)}
        ${renderInfoItem('Account Holder', 'Chủ tài khoản', hostelConfig.bank_owner)}
        ${renderInfoItem('Amount', 'Số tiền', `${formatVND(amount_due)} VND`)}
        ${renderInfoItem('Transfer Note', 'Nội dung CK', transferNote)}
      </div>
      <div style="width: 232px; flex: 0 0 232px; text-align: right;">
        <img src="${buildVietQrUrl(amount_due, transferNote)}" alt="QR" style="width: 220px; height: 220px; object-fit: contain;">
      </div>
    </div>

    ${renderFooter()}
  `

  return buildDocument(`Invoice ${invoiceNumber}`, bodyHTML)
}

export function openInvoice(reservation, invoice) {
  console.log('FULL RESERVATION:', JSON.stringify(reservation, null, 2))
  openDocumentPopup(buildInvoiceHtml(reservation, invoice))
}