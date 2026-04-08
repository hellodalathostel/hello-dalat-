import { buildDocument } from '../templates/baseDocument'
import { hostelConfig } from '../constants/hostelConfig'
import { openDocumentPopup } from '../utils/documentPopup'
import { formatVND } from '../utils/formatVND'
import { buildLineItems } from '../utils/buildLineItems.js'
import { buildVietQrUrl, escapeHtml, renderHeader } from './common'

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

function renderRoomServiceRows(rooms) {
  return rooms
    .map((room, index) => {
      const lineItems = buildLineItems(room)
      const detailRows = lineItems
        .map((item, itemIndex) => `
          <tr class="${item.type === 'discount' ? 'discount-row' : ''}">
            <td style="width: 9%;" class="amount">${index + 1}.${itemIndex + 1}</td>
            <td style="width: 12%;">${escapeHtml(room.roomId)}</td>
            <td style="width: 30%;">
              <div class="label-en">${escapeHtml(item.label_en || '')}</div>
              <div class="label-vi">${escapeHtml(item.label_vi || '')}</div>
            </td>
            <td style="width: 20%;">${item.detail ? escapeHtml(item.detail) : '-'}</td>
            <td style="width: 9%;" class="amount">${escapeHtml(String(item.qty || 1))}</td>
            <td style="width: 10%;" class="amount">${formatVND(Math.abs(Number(item.unit_price) || 0))}</td>
            <td style="width: 10%;" class="amount">${formatVND(Math.abs(Number(item.total) || 0))}</td>
          </tr>
        `)
        .join('')

      return `
        <tr>
          <td colspan="7" style="background:#f8fafc; border-top:2px solid #dbe2ea;">
            <span class="label-en">Room ${escapeHtml(room.roomId)} summary</span>
            <span class="label-vi">Chi tiết phòng ${escapeHtml(room.roomId)}</span>
          </td>
        </tr>
        ${detailRows}
      `
    })
    .join('')
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
  const subtotal = rooms.reduce((sum, room) => {
    const roomTotal = buildLineItems(room).reduce(
      (itemSum, item) => itemSum + (Number(item.total) || 0),
      0,
    )
    return sum + roomTotal
  }, 0)
  const totalDeposit = rooms.reduce((sum, room) => sum + (Number(room.depositPaid) || 0), 0)
  const cardFee = paymentMethod === 'card' ? Math.round(subtotal * 0.04) : 0
  const grandTotal = subtotal + cardFee
  const amountDue = Math.max(0, grandTotal - totalDeposit)
  const payment = toPaymentLabel(paymentMethod)
  const transferNote = `BILLDOAN ${group.group_name || ''}`.trim()

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
          ${renderTableHeaderCell('No.', 'STT', 'width: 9%;')}
          ${renderTableHeaderCell('Room', 'Phòng', 'width: 12%;')}
          ${renderTableHeaderCell('Item', 'Hạng mục', 'width: 30%;')}
          ${renderTableHeaderCell('Details', 'Chi tiết', 'width: 20%;')}
          ${renderTableHeaderCell('Qty', 'SL', 'width: 9%; text-align: right;')}
          ${renderTableHeaderCell('Unit Price', 'Đơn giá', 'width: 10%; text-align: right;')}
          ${renderTableHeaderCell('Amount', 'Thành tiền', 'width: 10%; text-align: right;')}
        </tr>
      </thead>
      <tbody>
        ${renderRoomServiceRows(rooms)}
        <tr class="total-row">
          <td colspan="6">
            <div class="label-en">Subtotal</div>
            <div class="label-vi">Tạm tính</div>
          </td>
          <td class="amount">${formatVND(Math.abs(subtotal))}</td>
        </tr>
        <tr class="total-row">
          <td colspan="6">
            <div class="label-en">Deposit Received (-)</div>
            <div class="label-vi">Đã đặt cọc (-)</div>
          </td>
          <td class="amount">${formatVND(Math.abs(totalDeposit))}</td>
        </tr>
        ${paymentMethod === 'card' ? `
          <tr class="total-row">
            <td colspan="6">
              <div class="label-en">Card Fee (4%)</div>
              <div class="label-vi">Phụ thu thẻ (4%)</div>
            </td>
            <td class="amount">${formatVND(Math.abs(cardFee))}</td>
          </tr>
        ` : ''}
        <tr class="due-row">
          <td colspan="6">
            <div class="label-en">Amount Due</div>
            <div class="label-vi">Số tiền cần thanh toán</div>
          </td>
          <td class="amount">${formatVND(Math.abs(amountDue))}</td>
        </tr>
      </tbody>
    </table>

    <div class="box bank">
      <div style="flex: 1; min-width: 0;">
        <div class="box-title">Bank Transfer Information<span class="box-title-vi">Thông tin chuyển khoản</span></div>
        ${renderInfoItem('Bank', 'Ngân hàng', hostelConfig.bank_name)}
        ${renderInfoItem('Account Number', 'Số tài khoản', hostelConfig.bank_account)}
        ${renderInfoItem('Account Holder', 'Chủ tài khoản', hostelConfig.bank_owner)}
        ${renderInfoItem('Amount', 'Số tiền', `${formatVND(amountDue)} VND`)}
        ${renderInfoItem('Transfer Note', 'Nội dung CK', transferNote)}
      </div>
      <div style="width: 232px; flex: 0 0 232px; text-align: right;">
        <img src="${buildVietQrUrl(amountDue, transferNote)}" alt="QR" style="width: 220px; height: 220px; object-fit: contain;">
      </div>
    </div>

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
