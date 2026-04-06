import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Booking, Guest, Invoice } from '../types'
import { HOSTEL_INFO } from '../constants/hostelInfo'
import { drawBankingInfo, drawFooter, drawHeader, formatDate, formatVND } from './pdfHelpers'

function getNights(checkIn: string, checkOut: string): number {
  const inDate = new Date(`${checkIn}T00:00:00`)
  const outDate = new Date(`${checkOut}T00:00:00`)
  const nights = Math.round((outDate.getTime() - inDate.getTime()) / (24 * 60 * 60 * 1000))
  return nights > 0 ? nights : 1
}

function paymentMethodLabel(method: Invoice['paymentMethod']): string {
  if (method === 'cash') return 'Tien mat'
  if (method === 'transfer') return 'Chuyen khoan'
  return 'The'
}

export async function generateInvoicePDF(
  invoice: Invoice,
  booking: Booking,
  guests: Guest[],
): Promise<void> {
  const doc = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm' })
  const guestName = invoice.guestName || guests[0]?.fullName || booking.guestName || 'Guest'
  const nights = getNights(booking.checkIn, booking.checkOut)
  const depositPaid = booking.depositPaid || 0
  const remaining = Math.max(0, invoice.total - depositPaid)

  let y = drawHeader(doc)

  doc.setTextColor(45, 80, 22)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('HOA DON DICH VU', 12, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(33, 37, 41)
  doc.text(`So HD: ${invoice.invoiceNumber}`, 198, y - 2, { align: 'right' })
  doc.text(`Ngay: ${formatDate(invoice.issueDate)}`, 198, y + 3, { align: 'right' })
  doc.text(`MST: ${HOSTEL_INFO.taxId}`, 198, y + 8, { align: 'right' })

  y += 12
  doc.setFillColor(248, 249, 250)
  doc.roundedRect(12, y, 186, 26, 2, 2, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Ten khach: ${guestName}`, 16, y + 7)
  doc.text(`Phong: ${booking.roomId}`, 16, y + 13)
  doc.text(`Check-in: ${formatDate(booking.checkIn)}`, 16, y + 19)

  doc.text(`Check-out: ${formatDate(booking.checkOut)}`, 108, y + 7)
  doc.text(`PTTT: ${paymentMethodLabel(invoice.paymentMethod)}`, 108, y + 13)
  doc.text(`So dem: ${nights} dem`, 108, y + 19)

  y += 32
  autoTable(doc, {
    startY: y,
    head: [['STT', 'Dich vu', 'SL', 'Don gia', 'Thanh tien']],
    body: invoice.lineItems.map((item, index) => [
      String(index + 1),
      item.description,
      String(item.quantity),
      formatVND(item.unitPrice),
      formatVND(item.total),
    ]),
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { fillColor: [45, 80, 22] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 34 },
    },
  })

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Tam tinh: ${formatVND(invoice.subtotal)}`, 198, y, { align: 'right' })
  y += 5

  if (invoice.discount > 0) {
    doc.text(`Giam gia: -${formatVND(invoice.discount)} ${invoice.discountNote ? `(${invoice.discountNote})` : ''}`, 198, y, {
      align: 'right',
    })
    y += 5
  }

  if (invoice.cardFeeApplied) {
    doc.text(`Phi the (4%): +${formatVND(invoice.cardFeeAmount)}`, 198, y, { align: 'right' })
    y += 5
  }

  doc.setDrawColor(180, 180, 180)
  doc.line(126, y, 198, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(45, 80, 22)
  doc.text(`TONG CONG: ${formatVND(invoice.total)}`, 198, y, { align: 'right' })

  y += 6
  doc.setTextColor(33, 37, 41)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Da dat coc (-): ${formatVND(depositPaid)}`, 198, y, { align: 'right' })
  y += 5
  doc.setDrawColor(180, 180, 180)
  doc.line(126, y, 198, y)
  y += 5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(`SO TIEN THANH TOAN: ${formatVND(remaining)}`, 198, y, { align: 'right' })

  if (invoice.paymentMethod === 'transfer' || remaining > 0) {
    y += 8
    const transferContent = `HOADON ${invoice.invoiceNumber} ${guestName}`
    y = await drawBankingInfo(doc, y, remaining, transferContent)
  }

  doc.setTextColor(invoice.status === 'paid' ? 45 : 220, invoice.status === 'paid' ? 80 : 53, invoice.status === 'paid' ? 22 : 69)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text(invoice.status === 'paid' ? 'DA THANH TOAN' : 'CHUA THANH TOAN', 140, 165, {
    angle: 30,
    align: 'center',
  })

  drawFooter(doc)

  const guestLastName = guestName.split(' ').at(-1) || guestName
  const fileName = `HOADON_${invoice.invoiceNumber}_${guestLastName}.pdf`
  doc.save(fileName)
}
