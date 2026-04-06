import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Booking, Guest, Room } from '../types'
import { drawBankingInfo, drawFooter, drawHeader, formatDate, formatVND } from './pdfHelpers'

const BREAKFAST_PRICE = 50000
const EXTRA_CHECK_FEE = 100000

function getNights(checkIn: string, checkOut: string): number {
  const inDate = new Date(`${checkIn}T00:00:00`)
  const outDate = new Date(`${checkOut}T00:00:00`)
  const nights = Math.round((outDate.getTime() - inDate.getTime()) / (24 * 60 * 60 * 1000))
  return nights > 0 ? nights : 1
}

function safeGuestName(guests: Guest[], booking: Booking): string {
  if (guests.length > 0) {
    return guests[0].fullName
  }
  return booking.guestName || 'Guest'
}

function roomDisplay(room: Room, booking: Booking): string {
  const roomName = room.number || room.id || booking.roomId
  return `${roomName} (${room.typeLabel || room.type})`
}

export async function generateDepositRequest(
  booking: Booking,
  guests: Guest[],
  room: Room,
): Promise<void> {
  const doc = new jsPDF({ format: 'a4', orientation: 'portrait', unit: 'mm' })
  const bookingId = booking.id.slice(0, 6).toUpperCase()
  const guestName = safeGuestName(guests, booking)
  const guestCount = guests.length || Math.max(1, booking.adults + booking.children)
  const nights = getNights(booking.checkIn, booking.checkOut)
  const roomTotal = nights * (booking.roomRate || 0)
  const breakfastTotal = booking.breakfastIncluded ? guestCount * nights * BREAKFAST_PRICE : 0
  const earlyTotal = booking.earlyCheckin ? EXTRA_CHECK_FEE : 0
  const lateTotal = booking.lateCheckout ? EXTRA_CHECK_FEE : 0
  const grandTotal = roomTotal + breakfastTotal + earlyTotal + lateTotal
  const depositAmount = booking.depositPaid > 0 ? booking.depositPaid : Math.round((booking.roomRate || 0) * 1)

  let y = drawHeader(doc)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(45, 80, 22)
  doc.text('YEU CAU DAT COC GIU PHONG', 105, y, { align: 'center' })
  doc.setDrawColor(45, 80, 22)
  doc.line(30, y + 2, 180, y + 2)

  y += 8
  doc.setFillColor(240, 247, 235)
  doc.roundedRect(12, y, 186, 34, 2, 2, 'F')

  doc.setFontSize(10)
  doc.setTextColor(33, 37, 41)
  doc.setFont('helvetica', 'normal')
  doc.text(`Ma dat phong: ${bookingId}`, 16, y + 7)
  doc.text(`Ten khach: ${guestName}`, 16, y + 13)
  doc.text(`So khach: ${guestCount} nguoi`, 16, y + 19)
  doc.text(`Nguon dat: ${booking.source || 'Direct'}`, 16, y + 25)

  doc.text(`Phong: ${roomDisplay(room, booking)}`, 108, y + 7)
  doc.text(`Check-in: ${formatDate(booking.checkIn)} - 14:00`, 108, y + 13)
  doc.text(`Check-out: ${formatDate(booking.checkOut)} - 12:00`, 108, y + 19)
  doc.text(`So dem: ${nights} dem`, 108, y + 25)

  y += 40
  autoTable(doc, {
    startY: y,
    head: [['Dich vu', 'Chi tiet', 'Thanh tien']],
    body: [
      ['Tien phong', `${nights} dem x ${formatVND(booking.roomRate || 0)}`, formatVND(roomTotal)],
      ...(booking.breakfastIncluded
        ? [['Breakfast', `${guestCount} nguoi x ${nights} dem x 50,000đ`, formatVND(breakfastTotal)]]
        : []),
      ...(booking.earlyCheckin ? [['Early Check-in', '1 lan', formatVND(EXTRA_CHECK_FEE)]] : []),
      ...(booking.lateCheckout ? [['Late Check-out', '1 lan', formatVND(EXTRA_CHECK_FEE)]] : []),
      ['TONG GIA TRI DAT PHONG', '', formatVND(grandTotal)],
    ],
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { fillColor: [45, 80, 22] },
    bodyStyles: { textColor: [33, 37, 41] },
    didParseCell: (data) => {
      if (data.row.index === data.table.body.length - 1) {
        data.cell.styles.fillColor = [45, 80, 22]
        data.cell.styles.textColor = [255, 255, 255]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  doc.setFillColor(255, 243, 205)
  doc.setDrawColor(255, 193, 7)
  doc.roundedRect(12, y, 186, 16, 2, 2, 'FD')
  doc.setTextColor(133, 100, 4)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(`So tien coc yeu cau: ${formatVND(depositAmount)}`, 16, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('(So coc se duoc tru vao tong hoa don khi check-out)', 16, y + 13)

  y += 22
  const transferContent = `COC ${bookingId} ${guestName}`
  y = await drawBankingInfo(doc, y, depositAmount, transferContent)

  doc.setDrawColor(222, 226, 230)
  doc.roundedRect(12, y, 186, 28, 2, 2)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(33, 37, 41)
  doc.text('Luu y quan trong:', 16, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('• Vui long chuyen khoan trong vong 24h de giu phong', 16, y + 12)
  doc.text('• Sau khi chuyen khoan, gui anh xac nhan cho hostel', 16, y + 17)
  doc.text('• Huy truoc 48h: hoan coc 100% | Huy trong 48h: mat coc', 16, y + 22)

  drawFooter(doc)

  const guestLastName = guestName.split(' ').at(-1) || guestName
  const fileName = `YEUCEUCOC_${bookingId}_${guestLastName}.pdf`
  doc.save(fileName)
}
