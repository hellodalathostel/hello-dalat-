import { buildDocument } from '../templates/baseDocument'
import { hostelConfig } from '../constants/hostelConfig'
import { openDocumentPopup } from '../utils/documentPopup'
import { formatVND } from '../utils/formatVND'
import { escapeHtml, renderHeader } from './common'

function renderTableHeaderCell(labelEn, labelVi, extraStyle = '') {
  return `
    <th${extraStyle ? ` style="${extraStyle}"` : ''}>
      <span class="th-en">${escapeHtml(labelEn)}</span>
      <span class="th-vi">${escapeHtml(labelVi)}</span>
    </th>
  `
}

function renderInfoItem(labelEn, labelVi, value) {
  return `
    <div class="info-item">
      <div class="label-en">${escapeHtml(labelEn)}</div>
      <div class="label-vi">${escapeHtml(labelVi)}</div>
      <div class="value">${escapeHtml(value)}</div>
    </div>
  `
}

function toPaymentLabel(method) {
  if (method === 'card') {
    return {
      en: 'Card',
      vi: 'Thanh toán thẻ',
    }
  }

  return {
    en: 'Cash',
    vi: 'Tiền mặt',
  }
}

export function buildGroupBillHtml(group, rooms, paymentMethod = 'cash') {
  const subtotal = rooms.reduce((sum, room) => sum + (Number(room.totalAmount) || 0), 0)
  const cardFee = paymentMethod === 'card' ? Math.round(subtotal * 0.04) : 0
  const grandTotal = subtotal + cardFee
  const payment = toPaymentLabel(paymentMethod)

  const rows = rooms
    .map((room, index) => `
      <tr>
        <td class="amount" style="width: 6%;">${index + 1}</td>
        <td style="width: 12%;">${escapeHtml(room.roomId)}</td>
        <td style="width: 14%;">${escapeHtml(room.checkIn)}</td>
        <td style="width: 14%;">${escapeHtml(room.checkOut)}</td>
        <td class="amount" style="width: 10%;">${escapeHtml(String(room.nights || 0))}</td>
        <td class="amount" style="width: 22%;">${formatVND(Number(room.roomRate || 0))}</td>
        <td class="amount" style="width: 22%;">${formatVND(Number(room.totalAmount || 0))}</td>
      </tr>
    `)
    .join('')

  const bodyHTML = `
    ${renderHeader('GROUP BILL', [`Tax ID: ${hostelConfig.tax_id}`], 'Hóa đơn đoàn')}

    <div class="info-grid" style="margin-bottom: 16px;">
      ${renderInfoItem('Group Name', 'Tên đoàn', group.group_name || '')}
      ${renderInfoItem('Created Date', 'Ngày tạo', group.created_at || '')}
      ${renderInfoItem('Payment Method', 'Phương thức thanh toán', `${payment.en} | ${payment.vi}`)}
      ${renderInfoItem('Room Count', 'Số phòng', String(rooms.length))}
    </div>

    <table>
      <thead>
        <tr>
          ${renderTableHeaderCell('No.', 'STT', 'width: 6%;')}
          ${renderTableHeaderCell('Room', 'Phòng', 'width: 12%;')}
          ${renderTableHeaderCell('Check-in', 'Ngày nhận', 'width: 14%;')}
          ${renderTableHeaderCell('Check-out', 'Ngày trả', 'width: 14%;')}
          ${renderTableHeaderCell('Nights', 'Số đêm', 'width: 10%; text-align: right;')}
          ${renderTableHeaderCell('Rate/Night', 'Đơn giá', 'width: 22%; text-align: right;')}
          ${renderTableHeaderCell('Subtotal', 'Thành tiền', 'width: 22%; text-align: right;')}
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="6">
            <div class="label-en">Subtotal</div>
            <div class="label-vi">Tạm tính</div>
          </td>
          <td class="amount">${formatVND(subtotal)}</td>
        </tr>
        ${paymentMethod === 'card' ? `
          <tr class="total-row">
            <td colspan="6">
              <div class="label-en">Card Fee (4%)</div>
              <div class="label-vi">Phụ thu thẻ (4%)</div>
            </td>
            <td class="amount">${formatVND(cardFee)}</td>
          </tr>
        ` : ''}
        <tr class="due-row">
          <td colspan="6">
            <div class="label-en">Grand Total</div>
            <div class="label-vi">Tổng thanh toán</div>
          </td>
          <td class="amount">${formatVND(grandTotal)}</td>
        </tr>
      </tbody>
    </table>

    ${paymentMethod === 'card' ? `
      <div class="box warning">
        <div class="box-title">Card Payment Note<span class="box-title-vi">Lưu ý thanh toán thẻ</span></div>
        <p>Card payments include a 4% surcharge.<span class="vi-note">Thanh toán bằng thẻ có phụ thu 4%.</span></p>
      </div>
    ` : ''}

    <div class="doc-footer">
      <span class="footer-en">Thank you for choosing Hello Dalat Hostel!</span>
      <span class="vi-note">Cảm ơn quý khách đã sử dụng dịch vụ!</span>
    </div>
  `

  return buildDocument(`Group Bill ${group.group_name || ''}`, bodyHTML)
}

export function openGroupBill(group, rooms, paymentMethod = 'cash') {
  openDocumentPopup(buildGroupBillHtml(group, rooms, paymentMethod))
}
