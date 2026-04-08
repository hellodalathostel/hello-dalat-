import { format, parseISO } from 'date-fns'
import type { Booking } from '../../types'

interface BookingTooltipProps {
  booking: Booking
  onOpenDetail: (bookingId: string) => void
}

const statusLabels: Record<Booking['status'], string> = {
  confirmed: 'Đã xác nhận',
  checkedin: 'Đã check-in',
  checkedout: 'Đã check-out',
  cancelled: 'Đã hủy',
  noshow: 'No-show',
}

const sourceLabels: Record<Booking['source'], string> = {
  direct: 'Trực tiếp',
  'booking.com': 'Booking.com',
  airbnb: 'Airbnb',
  walkin: 'Khách vãng lai',
}

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

export default function BookingTooltip({
  booking,
  onOpenDetail,
}: BookingTooltipProps) {
  return (
    <div className="absolute left-0 top-full z-[70] mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            Khách
          </p>
          <p className="text-sm font-semibold text-slate-900">{booking.guestName}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {statusLabels[booking.status]}
        </span>
      </div>

      <div className="space-y-2 text-sm text-slate-600">
        <div className="flex justify-between gap-4">
          <span>Nhận phòng</span>
          <span className="font-medium text-slate-900">
            {format(parseISO(booking.checkIn), 'dd/MM/yyyy')}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Trả phòng</span>
          <span className="font-medium text-slate-900">
            {format(parseISO(booking.checkOut), 'dd/MM/yyyy')}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Đêm</span>
          <span className="font-medium text-slate-900">{booking.nights}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Phòng</span>
          <span className="font-medium text-slate-900">{booking.roomId}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Nguồn</span>
          <span className="font-medium text-slate-900">
            {sourceLabels[booking.source]}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Tổng tiền</span>
          <span className="font-medium text-slate-900">
            {currencyFormatter.format(booking.totalAmount)}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpenDetail(booking.id)}
        className="mt-4 w-full rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/15"
      >
        Xem chi tiết
      </button>
    </div>
  )
}