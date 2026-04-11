import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileSpreadsheet } from 'lucide-react'
import { useGroupBookings } from '../hooks/useGroupBookings'
import { openGroupBill } from '../documents/groupBill'
import type { Booking, GroupBooking } from '../types'
import { formatMoney } from '../utils/formatMoney'

function toStatusLabel(status: GroupBooking['status']) {
  switch (status) {
    case 'checked_in':
      return 'Đã check-in'
    case 'checked_out':
      return 'Đã check-out'
    case 'cancelled':
      return 'Đã hủy'
    default:
      return 'Đã xác nhận'
  }
}

function bookingStatusLabel(status: Booking['status']) {
  switch (status) {
    case 'checkedin':
      return 'Đã check-in'
    case 'checkedout':
      return 'Đã check-out'
    case 'cancelled':
      return 'Đã hủy'
    case 'noshow':
      return 'No-show'
    default:
      return 'Đã xác nhận'
  }
}

export default function GroupBookingDetailPage() {
  const { groupId = '' } = useParams()
  const { getGroupBookingDetail, updateSingleBookingStatus, cancelGroupBooking } = useGroupBookings()
  const [group, setGroup] = useState<GroupBooking | null>(null)
  const [rooms, setRooms] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [billPaymentMethod, setBillPaymentMethod] = useState<'cash' | 'card'>('cash')

  const loadDetail = useCallback(async () => {
    if (!groupId) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const detail = await getGroupBookingDetail(groupId)
      if (!detail) {
        setGroup(null)
        setRooms([])
        return
      }

      setGroup(detail.group)
      setRooms(detail.rooms)
    } catch (loadError) {
      console.error(loadError)
      setError('Không thể tải chi tiết booking đoàn.')
    } finally {
      setLoading(false)
    }
  }, [groupId, getGroupBookingDetail])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const rows = useMemo(
    () =>
      rooms.map((room) => ({
        ...room,
        subtotal: Number(room.totalAmount || 0),
      })),
    [rooms],
  )

  const grandTotal = useMemo(
    () => rows.reduce((sum, row) => sum + row.subtotal, 0),
    [rows],
  )

  async function handleBookingStatus(bookingId: string, status: Booking['status']) {
    if (!groupId) {
      return
    }

    setBusyId(bookingId)
    try {
      await updateSingleBookingStatus(groupId, bookingId, status)
      await loadDetail()
    } catch (updateError) {
      console.error(updateError)
      setError('Không thể cập nhật trạng thái phòng.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleCancelGroup() {
    if (!groupId) {
      return
    }

    setBusyId('group-cancel')
    try {
      await cancelGroupBooking(groupId)
      await loadDetail()
    } catch (cancelError) {
      console.error(cancelError)
      setError('Không thể hủy booking đoàn.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f3e8] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[28px] border border-primary/10 bg-white p-5 shadow-sm md:p-6">
          <Link to="/group-bookings" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Quay lại booking đoàn
          </Link>

          {loading ? <p className="mt-4 text-sm text-slate-500">Đang tải...</p> : null}
          {!loading && !group ? <p className="mt-4 text-sm text-red-600">Không tìm thấy booking đoàn.</p> : null}

          {group ? (
            <>
              <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-semibold text-slate-900">{group.groupName}</h1>
                  <p className="mt-2 text-sm text-slate-500">Tạo lúc: {group.createdAt}</p>
                  {group.note ? <p className="mt-1 text-sm text-slate-600">Ghi chú: {group.note}</p> : null}
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                  {toStatusLabel(group.status)}
                </span>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#faf8f1] text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Phòng</th>
                      <th className="px-3 py-2 text-left">Nhận</th>
                      <th className="px-3 py-2 text-left">Trả</th>
                      <th className="px-3 py-2 text-right">Số đêm</th>
                      <th className="px-3 py-2 text-right">Đơn giá</th>
                      <th className="px-3 py-2 text-right">Thành tiền</th>
                      <th className="px-3 py-2 text-left">Trạng thái phòng</th>
                      <th className="px-3 py-2 text-left">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-200 bg-white">
                        <td className="px-3 py-2 font-medium text-slate-900">{row.roomId}</td>
                        <td className="px-3 py-2 text-slate-700">{row.checkIn}</td>
                        <td className="px-3 py-2 text-slate-700">{row.checkOut}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{row.nights}</td>
                        <td className="px-3 py-2 text-right text-slate-700">{formatMoney(row.roomRate)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatMoney(row.subtotal)}</td>
                        <td className="px-3 py-2 text-slate-700">{bookingStatusLabel(row.status)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              disabled={busyId === row.id || row.status === 'checkedin'}
                              onClick={() => void handleBookingStatus(row.id, 'checkedin')}
                              className="rounded-lg border border-blue-200 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                            >
                              Check-in
                            </button>
                            <button
                              disabled={busyId === row.id || row.status === 'checkedout'}
                              onClick={() => void handleBookingStatus(row.id, 'checkedout')}
                              className="rounded-lg border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                            >
                              Check-out
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-300 bg-[#faf8f1]">
                      <td className="px-3 py-2 font-semibold text-slate-900" colSpan={5}>Tổng cộng</td>
                      <td className="px-3 py-2 text-right text-base font-bold text-slate-900">{formatMoney(grandTotal)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <select
                  value={billPaymentMethod}
                  onChange={(event) => setBillPaymentMethod(event.target.value as 'cash' | 'card')}
                  className="rounded-xl border border-slate-200 bg-[#fffdf8] px-3 py-2 text-sm text-slate-700"
                >
                  <option value="cash">Tiền mặt</option>
                  <option value="card">Thẻ (phụ thu 4%)</option>
                </select>

                <button
                  onClick={() => openGroupBill(group, rows, billPaymentMethod)}
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/15"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Xuất bill đoàn
                </button>

                <button
                  disabled={busyId === 'group-cancel' || group.status === 'cancelled'}
                  onClick={() => void handleCancelGroup()}
                  className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  Hủy đoàn
                </button>
              </div>
            </>
          ) : null}

          {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}
        </div>
      </div>
    </main>
  )
}
