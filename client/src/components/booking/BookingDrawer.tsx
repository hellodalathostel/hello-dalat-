import { X } from 'lucide-react'
import { deleteDoc, doc } from 'firebase/firestore'
import { useState } from 'react'
import { db } from '../../firebase'
import type { Booking } from '../../types'
import BookingForm from './BookingForm'

interface BookingDrawerProps {
  booking?: Booking
  defaultRoomId?: string
  defaultDate?: string
  onClose: () => void
  onSaved: () => void
}

export default function BookingDrawer({
  booking,
  defaultRoomId,
  defaultDate,
  onClose,
  onSaved,
}: BookingDrawerProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleDeleteBooking() {
    if (!booking) {
      return
    }

    const isConfirmed = window.confirm(
      `Xóa booking của ${booking.guestName}? Không thể hoàn tác.`,
    )

    if (!isConfirmed) {
      return
    }

    setDeleting(true)

    try {
      await deleteDoc(doc(db, 'bookings', booking.id))
      onSaved()
      onClose()
    } catch (error) {
      console.error(error)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Đóng drawer"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl md:w-[480px]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 md:px-6 md:py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {booking ? 'Chỉnh sửa booking' : 'Tạo booking mới'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fffdf8]">
          <BookingForm
            booking={booking}
            defaultRoomId={defaultRoomId}
            defaultDate={defaultDate}
            onClose={onClose}
            onSaved={onSaved}
          />
        </div>

        {booking ? (
          <div className="flex items-center border-t border-slate-200 bg-white px-4 py-3 md:px-6">
            <button
              type="button"
              onClick={() => {
                void handleDeleteBooking()
              }}
              disabled={deleting}
              className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? 'Đang xóa...' : 'Xóa booking'}
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  )
}