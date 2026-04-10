import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useOverviewData } from '../hooks/useOverviewData'
import type { Booking } from '../types'

const brandColor = '#2D5016'
const pieColors = ['#2D5016', '#557f33', '#7aa453', '#a8c77f', '#d8e6c8']

function formatMoney(value: number) {
  return `${value.toLocaleString('vi-VN')} đ`
}

function statusLabel(status: Booking['status']) {
  switch (status) {
    case 'checkedin':
      return 'Đang ở'
    case 'checkedout':
      return 'Đã trả phòng'
    case 'cancelled':
      return 'Đã hủy'
    case 'noshow':
      return 'Không đến'
    default:
      return 'Đã xác nhận'
  }
}

function statusBadgeClass(status: Booking['status']) {
  if (status === 'checkedin') {
    return 'bg-primary/10 text-primary'
  }

  if (status === 'checkedout') {
    return 'bg-slate-100 text-slate-600'
  }

  if (status === 'cancelled' || status === 'noshow') {
    return 'bg-red-50 text-red-500'
  }

  return 'bg-amber-50 text-amber-700'
}

function activityRow(booking: Booking) {
  return (
    <li key={booking.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-2">
      <div>
        <p className="text-sm font-semibold text-slate-800">Phòng {booking.roomId}</p>
        <p className="text-sm text-slate-600">{booking.guestName || 'Khách lẻ'}</p>
      </div>
      <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(booking.status)}`}>
        {statusLabel(booking.status)}
      </span>
    </li>
  )
}

export default function OverviewPage() {
  const {
    loading,
    error,
    metrics,
    occupancySeries,
    revenueBreakdown,
    checkInsToday,
    checkOutsToday,
    today,
  } = useOverviewData()

  return (
    <main className="min-h-screen bg-[#f6f3e8] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] border border-primary/10 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-primary/60">Overview Dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">Tổng quan vận hành</h1>
              <p className="mt-2 text-sm text-slate-500">Dữ liệu realtime cho hôm nay và tháng hiện tại.</p>
            </div>
          </div>

          {metrics.unpaidTotal > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              ⚠️ Có {metrics.unpaidCount} khoản công nợ chưa thu — {formatMoney(metrics.unpaidTotal)}.{' '}
              <Link to="/finance?tab=debt" className="font-semibold underline">
                Xem công nợ
              </Link>
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <article className="rounded-xl border border-primary/10 bg-[#faf8f1] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Hôm nay - Công suất</p>
              <p className="mt-1 text-lg font-semibold text-primary">
                {metrics.occupiedToday} / {metrics.totalRooms} phòng
              </p>
            </article>
            <article className="rounded-xl border border-primary/10 bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Hôm nay - Doanh thu</p>
              <p className="mt-1 text-lg font-semibold text-primary">{formatMoney(metrics.revenueTodayPaid)}</p>
            </article>
            <article className="rounded-xl border border-primary/10 bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Tháng này - Doanh thu</p>
              <p className="mt-1 text-lg font-semibold text-primary">{formatMoney(metrics.revenueMonthPaid)}</p>
            </article>
            <article className="rounded-xl border border-red-100 bg-red-50/40 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Tháng này - Chi phí</p>
              <p className="mt-1 text-lg font-semibold text-red-500">{formatMoney(metrics.expenseMonth)}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Tháng này - Lợi nhuận</p>
              <p className={`mt-1 text-lg font-semibold ${metrics.profitMonth >= 0 ? 'text-primary' : 'text-red-500'}`}>
                {formatMoney(metrics.profitMonth)}
              </p>
            </article>
            <article className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Công nợ chưa thu</p>
              <p className="mt-1 text-lg font-semibold text-amber-700">{formatMoney(metrics.unpaidTotal)}</p>
            </article>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </section>
        ) : null}

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <article className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm xl:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Công suất phòng 30 ngày gần nhất</h2>
              <span className="text-xs text-slate-500">Theo tỷ lệ % / ngày</span>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={occupancySeries} margin={{ left: 0, right: 0, top: 8, bottom: 8 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={3} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value, _name, payload) => {
                      const numValue = typeof value === 'number' ? value : 0
                      const occupiedRooms = (payload?.payload as { occupiedRooms?: number } | undefined)?.occupiedRooms ?? 0
                      return [`${numValue}% (${occupiedRooms}/8 phòng)`, 'Công suất']
                    }}
                  />
                  <Bar dataKey="occupancyRate" radius={[6, 6, 0, 0]}>
                    {occupancySeries.map((entry) => (
                      <Cell key={entry.date} fill={entry.date === today ? brandColor : '#c8d8be'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Cơ cấu doanh thu tháng</h2>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueBreakdown}
                    dataKey="amount"
                    nameKey="label"
                    innerRadius={56}
                    outerRadius={94}
                    paddingAngle={2}
                  >
                    {revenueBreakdown.map((entry, index) => (
                      <Cell key={entry.category} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatMoney(typeof value === 'number' ? value : 0), 'Doanh thu']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {revenueBreakdown.map((item, index) => (
                <div key={item.category} className="flex items-center justify-between rounded-lg border border-slate-100 px-2 py-1.5">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pieColors[index % pieColors.length] }} />
                    {item.label}
                  </span>
                  <span className="font-semibold text-slate-700">{formatMoney(item.amount)}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Check-in hôm nay</h2>
            {loading ? (
              <p className="text-sm text-slate-500">Đang tải dữ liệu...</p>
            ) : checkInsToday.length === 0 ? (
              <p className="text-sm text-slate-500">Không có lượt check-in hôm nay.</p>
            ) : (
              <ul className="space-y-2">{checkInsToday.map(activityRow)}</ul>
            )}
          </article>

          <article className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-base font-semibold text-slate-900">Check-out hôm nay</h2>
            {loading ? (
              <p className="text-sm text-slate-500">Đang tải dữ liệu...</p>
            ) : checkOutsToday.length === 0 ? (
              <p className="text-sm text-slate-500">Không có lượt check-out hôm nay.</p>
            ) : (
              <ul className="space-y-2">{checkOutsToday.map(activityRow)}</ul>
            )}
          </article>
        </section>
      </div>
    </main>
  )
}
