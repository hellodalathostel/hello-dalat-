import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import BookingDrawer from '../components/booking/BookingDrawer'
import CalendarGrid from '../components/calendar/CalendarGrid'
import SyncStatusWidget from '../components/dashboard/SyncStatusWidget'
import { useBookings } from '../hooks/useBookings'
import { useFinance } from '../hooks/useFinance'
import type { Booking } from '../types'

function getInitialWeekStart() {
  return startOfWeek(new Date(), { weekStartsOn: 1 })
}

export default function DashboardPage() {
  const [weekStart, setWeekStart] = useState(getInitialWeekStart)
  const [drawerState, setDrawerState] = useState<{
    isOpen: boolean
    booking?: Booking
    defaultRoomId?: string
    defaultDate?: string
  }>({ isOpen: false })

  const startDate = format(weekStart, 'yyyy-MM-dd')
  const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd')
  const currentMonth = format(new Date(), 'yyyy-MM')
  const { bookings, loading, error, refetch } = useBookings(startDate, endDate)
  const { totalIncome, totalExpense, netProfit } = useFinance(currentMonth)

  const formatMoney = (value: number) => `${value.toLocaleString('vi-VN')} đ`

  return (
    <main className="min-h-screen bg-[#f6f3e8] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-primary/10 bg-white/80 p-5 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-primary/60">
              Availability Calendar
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              Lịch phòng trong tuần
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
              <CalendarDays className="h-4 w-4" />
              {format(weekStart, 'dd/MM/yyyy')} - {format(addDays(weekStart, 6), 'dd/MM/yyyy')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setDrawerState({ isOpen: true })
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Tạo booking
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-[28px] border border-primary/10 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekStart((current) => addDays(current, -7))}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-primary/30 hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" />
              Tuần trước
            </button>
            <button
              type="button"
              onClick={() => setWeekStart(getInitialWeekStart())}
              className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/15"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => setWeekStart((current) => addDays(current, 7))}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-primary/30 hover:text-primary"
            >
              Tuần sau
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <label className="flex items-center gap-3 text-sm text-slate-600">
            <span>Chọn tuần</span>
            <input
              type="date"
              value={startDate}
              onChange={(event) => {
                if (!event.target.value) {
                  return
                }

                setWeekStart(
                  startOfWeek(parseISO(event.target.value), { weekStartsOn: 1 }),
                )
              }}
              className="rounded-xl border border-slate-200 bg-[#fffdf8] px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
        </div>

        <section className="grid grid-cols-1 gap-3 rounded-[28px] border border-primary/10 bg-white p-4 shadow-sm md:grid-cols-4 md:p-5">
          <article className="rounded-xl border border-primary/10 bg-[#faf8f1] px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Doanh thu</p>
            <p className="mt-1 text-lg font-semibold text-primary">{formatMoney(totalIncome)}</p>
          </article>
          <article className="rounded-xl border border-red-100 bg-red-50/40 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Chi phí</p>
            <p className="mt-1 text-lg font-semibold text-red-500">{formatMoney(totalExpense)}</p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Lợi nhuận</p>
            <p className={`mt-1 text-lg font-semibold ${netProfit >= 0 ? 'text-primary' : 'text-red-500'}`}>
              {formatMoney(netProfit)}
            </p>
          </article>
          <SyncStatusWidget />
        </section>

        <CalendarGrid
          weekStart={weekStart}
          bookings={bookings}
          loading={loading}
          error={error}
          onCreateBooking={(roomId, date) => {
            setDrawerState({
              isOpen: true,
              defaultRoomId: roomId,
              defaultDate: date,
            })
          }}
          onEditBooking={(booking) => {
            setDrawerState({ isOpen: true, booking })
          }}
        />
      </div>

      {drawerState.isOpen ? (
        <BookingDrawer
          booking={drawerState.booking}
          defaultRoomId={drawerState.defaultRoomId}
          defaultDate={drawerState.defaultDate}
          onClose={() => setDrawerState({ isOpen: false })}
          onSaved={() => {
            refetch()
          }}
        />
      ) : null}
    </main>
  )
}
