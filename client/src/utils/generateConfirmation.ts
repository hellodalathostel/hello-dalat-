import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Booking, Guest, Room } from '../types'
import { HOSTEL_INFO } from '../constants/hostelInfo'
import { drawFooter, drawHeader, formatDate, formatVND } from './pdfHelpers'

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

export async function generateConfirmation(
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
  const depositPaid = booking.depositPaid || 0
  const remaining = Math.max(0, grandTotal - depositPaid)

  let y = drawHeader(doc)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(45, 80, 22)
  doc.text('PHIEU XAC NHAN DAT PHONG', 105, y, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Phong da duoc xac nhan va giu cho cho quy khach', 105, y + 5, { align: 'center' })

  doc.setFillColor(45, 80, 22)
  doc.roundedRect(146, y - 4, 50, 10, 2, 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('DA XAC NHAN', 171, y + 2, { align: 'center' })

  y += 10
  doc.setTextColor(33, 37, 41)
  doc.setFillColor(240, 247, 235)
  doc.roundedRect(12, y, 186, 38, 2, 2, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Ma dat phong: ${bookingId}`, 16, y + 7)
  doc.text(`Ten khach: ${guestName}`, 16, y + 13)
  doc.text(`So khach: ${guestCount} nguoi`, 16, y + 19)
  doc.text(`Nguon dat: ${booking.source || 'Direct'}`, 16, y + 25)
  doc.setFont('helvetica', 'bold')
  doc.text(`Dat coc da nhan: ${formatVND(depositPaid)} ✓`, 16, y + 31)

  doc.setFont('helvetica', 'normal')
  doc.text(`Phong: ${roomDisplay(room, booking)}`, 108, y + 7)
  doc.text(`Check-in: ${formatDate(booking.checkIn)} - 14:00`, 108, y + 13)
  doc.text(`Check-out: ${formatDate(booking.checkOut)} - 12:00`, 108, y + 19)
  doc.text(`So dem: ${nights} dem`, 108, y + 25)

  y += 44
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
      ['Tong cong', '', formatVND(grandTotal)],
      ['Da dat coc (-)', '', `-${formatVND(depositPaid)}`],
      ['Con lai (check-out)', '', formatVND(remaining)],
    ],
    styles: { font: 'helvetica', fontSize: 9 },
    headStyles: { fillColor: [45, 80, 22] },
    didParseCell: (data) => {
      const idx = data.row.index
      if (idx === data.table.body.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        if (data.column.index === 2 && remaining > 0) {
          data.cell.styles.textColor = [220, 53, 69]
        }
      }
    },
  })

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y
  y += 6

  doc.setFillColor(232, 244, 253)
  doc.setDrawColor(13, 110, 253)
  doc.roundedRect(12, y, 186, 29, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Thong tin check-in:', 16, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`• Dia chi: ${HOSTEL_INFO.address}`, 16, y + 12)
  doc.text('• Gio check-in: tu 14:00 | Check-out: 12:00', 16, y + 17)
  doc.text('• Can mang CMND/CCCD/Ho chieu khi nhan phong', 16, y + 22)
  doc.text(`• Lien he khi den: ${HOSTEL_INFO.phone}`, 16, y + 27)

  if (booking.notes?.trim()) {
    y += 34
    doc.setFillColor(255, 243, 205)
    doc.roundedRect(12, y, 186, 14, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Ghi chu dac biet:', 16, y + 6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(booking.notes.trim(), 16, y + 11)
  }

  drawFooter(doc)

  const guestLastName = guestName.split(' ').at(-1) || guestName
  const fileName = `XACNHAN_${bookingId}_${guestLastName}.pdf`
  doc.save(fileName)
}
