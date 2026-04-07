import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import { Link, useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { useGroupBookings } from '../hooks/useGroupBookings'
import type { Booking } from '../types'

const BREAKFAST_PRICE = 35000

const roomOptions = [
  { value: '101', label: '101 - Family', rate: 450000 },
  { value: '102', label: '102 - Single', rate: 180000 },
  { value: '202', label: '202 - Single', rate: 180000 },
  { value: '103', label: '103 - Deluxe Double', rate: 300000 },
  { value: '203', label: '203 - Deluxe Double', rate: 300000 },
  { value: '201', label: '201 - Deluxe Queen', rate: 400000 },
  { value: '301', label: '301 - Standard Double', rate: 250000 },
  { value: '302', label: '302 - Standard Double', rate: 250000 },
] as const

interface GroupRoomRow {
  id: string
  roomId: string
  checkIn: string
  checkOut: string
  guests: number
  breakfastIncluded: boolean
}

function makeRoomRow(defaultDate: string): GroupRoomRow {
  return {
    id: `${Date.now().toString()}-${Math.random().toString(36).slice(2, 8)}`,
    roomId: roomOptions[0].value,
    checkIn: defaultDate,
    checkOut: format(addDays(parseISO(defaultDate), 1), 'yyyy-MM-dd'),
    guests: 1,
    breakfastIncluded: false,
  }
}

function toVnd(value: number) {
  return `${value.toLocaleString('vi-VN')} đ`
}

function toNights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) {
    return 0
  }

  const nights = differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn))
  return Number.isNaN(nights) ? 0 : Math.max(0, nights)
}

function overlaps(row: GroupRoomRow, booking: Booking) {
  return row.checkIn < booking.checkOut && row.checkOut > booking.checkIn
}

function statusLabel(status: string) {
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

export default function GroupBookingsPage() {
  const navigate = useNavigate()
  const today = format(new Date(), 'yyyy-MM-dd')
  const [groupName, setGroupName] = useState('')
  const [note, setNote] = useState('')
  const [rows, setRows] = useState<GroupRoomRow[]>(() => [makeRoomRow(today)])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const { groups, bookings, loading, createGroupBooking } = useGroupBookings()

  const roomBookings = useMemo(
    () => bookings.filter((booking) => booking.status !== 'cancelled'),
    [bookings],
  )

  const rowSummaries = useMemo(
    () =>
      rows.map((row) => {
        const roomMeta = roomOptions.find((option) => option.value === row.roomId) ?? roomOptions[0]
        const nights = toNights(row.checkIn, row.checkOut)
        const roomSubtotal = nights * roomMeta.rate
        const breakfastSubtotal = row.breakfastIncluded
          ? nights * row.guests * BREAKFAST_PRICE
          : 0

        return {
          ...row,
          roomLabel: roomMeta.label,
          nights,
          roomRate: roomMeta.rate,
          roomSubtotal,
          breakfastSubtotal,
          subtotal: roomSubtotal + breakfastSubtotal,
        }
      }),
    [rows],
  )

  const duplicateRoomIds = useMemo(() => {
    const countByRoom = rows.reduce<Record<string, number>>((map, row) => {
      map[row.roomId] = (map[row.roomId] ?? 0) + 1
      return map
    }, {})

    return new Set(Object.entries(countByRoom).filter(([, count]) => count > 1).map(([roomId]) => roomId))
  }, [rows])

  const conflictsByRowId = useMemo(() => {
    const map: Record<string, string[]> = {}

    rowSummaries.forEach((row) => {
      const conflicts = roomBookings.filter(
        (booking) => booking.roomId === row.roomId && overlaps(row, booking),
      )

      if (conflicts.length > 0) {
        map[row.id] = conflicts.map(
          (booking) => `${booking.roomId}: ${booking.checkIn} - ${booking.checkOut}`,
        )
      }
    })

    return map
  }, [roomBookings, rowSummaries])

  const grandTotal = useMemo(
    () => rowSummaries.reduce((sum, row) => sum + row.subtotal, 0),
    [rowSummaries],
  )

  function updateRow<K extends keyof GroupRoomRow>(id: string, key: K, value: GroupRoomRow[K]) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [key]: value } : row)))
  }

  function addRow() {
    setRows((current) => [...current, makeRoomRow(today)])
  }

  function removeRow(id: string) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!groupName.trim()) {
      setError('Vui lòng nhập tên đoàn.')
      return
    }

    if (rows.length === 0) {
      setError('Cần ít nhất 1 phòng trong booking đoàn.')
      return
    }

    if (duplicateRoomIds.size > 0) {
      setError('Một phòng không thể xuất hiện 2 lần trong cùng booking đoàn.')
      return
    }

    const invalidRow = rowSummaries.find(
      (row) => !row.roomId || !row.checkIn || !row.checkOut || row.nights <= 0,
    )

    if (invalidRow) {
      setError('Mỗi dòng phòng phải có phòng, ngày nhận/trả và số đêm hợp lệ.')
      return
    }

    const rowWithConflict = rowSummaries.find((row) => (conflictsByRowId[row.id] ?? []).length > 0)
    if (rowWithConflict) {
      setError(`Phòng ${rowWithConflict.roomId} đã có booking trùng ngày.`)
      return
    }

    setSaving(true)

    try {
      const groupId = await createGroupBooking({
        groupName,
        note,
        rooms: rowSummaries.map((row) => ({
          roomId: row.roomId,
          checkIn: row.checkIn,
          checkOut: row.checkOut,
          guests: row.guests,
          roomRate: row.roomRate,
          breakfastIncluded: row.breakfastIncluded,
        })),
      })

      navigate(`/group-bookings/${groupId}`)
    } catch (submitError) {
      console.error(submitError)
      setError('Không thể tạo booking đoàn. Vui lòng thử lại.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f3e8] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-[28px] border border-primary/10 bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary/60">Group Booking</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">Tạo Booking Đoàn</h1>
              <p className="mt-2 text-sm text-slate-500">Mỗi đoàn gồm nhiều phòng, tổng bill tách theo từng phòng.</p>
            </div>
            <Users className="h-10 w-10 text-primary/40" />
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Tên đoàn *</span>
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Ví dụ: Đoàn Hà Nội 5 phòng"
                  className="w-full rounded-xl border border-slate-200 bg-[#fffdf8] px-3 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-medium">Ghi chú</span>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Thông tin thêm cho đoàn"
                  className="w-full rounded-xl border border-slate-200 bg-[#fffdf8] px-3 py-2.5 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
            </div>

            <div className="space-y-3">
              {rowSummaries.map((row, index) => {
                const hasDuplicate = duplicateRoomIds.has(row.roomId)
                const conflicts = conflictsByRowId[row.id] ?? []

                return (
                  <div key={row.id} className="rounded-2xl border border-slate-200 bg-[#fffefb] p-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                      <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
                        <span className="font-medium">Phòng</span>
                        <select
                          value={row.roomId}
                          onChange={(event) => updateRow(row.id, 'roomId', event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
                        >
                          {roomOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1 text-xs text-slate-600">
                        <span className="font-medium">Nhận phòng</span>
                        <input
                          type="date"
                          value={row.checkIn}
                          onChange={(event) => updateRow(row.id, 'checkIn', event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
                        />
                      </label>

                      <label className="space-y-1 text-xs text-slate-600">
                        <span className="font-medium">Trả phòng</span>
                        <input
                          type="date"
                          value={row.checkOut}
                          onChange={(event) => updateRow(row.id, 'checkOut', event.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
                        />
                      </label>

                      <label className="space-y-1 text-xs text-slate-600">
                        <span className="font-medium">Số khách</span>
                        <input
                          type="number"
                          min={1}
                          value={row.guests}
                          onChange={(event) => updateRow(row.id, 'guests', Math.max(1, Number(event.target.value) || 1))}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm"
                        />
                      </label>

                      <div className="flex items-end justify-between gap-2 md:col-span-1">
                        <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-right text-sm font-semibold text-emerald-700">
                          {toVnd(row.subtotal)}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="rounded-lg border border-red-200 px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={row.breakfastIncluded}
                          onChange={(event) => updateRow(row.id, 'breakfastIncluded', event.target.checked)}
                        />
                        Thêm breakfast (35,000 đ/người/đêm)
                      </label>
                      <span>Số đêm: {row.nights}</span>
                      <span>Giá phòng/đêm: {toVnd(row.roomRate)}</span>
                      {row.breakfastIncluded ? <span>Breakfast: {toVnd(row.breakfastSubtotal)}</span> : null}
                      <span>Tạm tính: {toVnd(row.subtotal)}</span>
                    </div>

                    {hasDuplicate ? (
                      <p className="mt-2 text-xs font-medium text-red-600">Phòng này đang bị chọn trùng trong cùng đoàn.</p>
                    ) : null}
                    {conflicts.length > 0 ? (
                      <p className="mt-1 text-xs font-medium text-red-600">
                        Trùng lịch với booking hiện có: {conflicts.join('; ')}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-400">Dòng #{index + 1}</p>
                  </div>
                )
              })}

              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
              >
                <Plus className="h-4 w-4" />
                Thêm phòng
              </button>
            </div>

            <div className="rounded-2xl border border-primary/15 bg-[#faf8f1] p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-primary/70">Tóm tắt</h2>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {rowSummaries.map((row) => (
                  <div key={`${row.id}-summary`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                    <span>
                      {row.roomLabel} • {row.checkIn} → {row.checkOut}
                    </span>
                    <span className="font-semibold">{toVnd(row.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-primary/10 pt-3 text-base font-semibold text-slate-900">
                <span>Tổng cộng</span>
                <span>{toVnd(grandTotal)}</span>
              </div>
            </div>

            {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

            <button
              disabled={saving || loading}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {saving ? 'Đang tạo...' : 'Tạo Booking Đoàn'}
            </button>
          </form>
        </section>

        <section className="rounded-[28px] border border-primary/10 bg-white p-5 shadow-sm md:p-6">
          <h2 className="text-xl font-semibold text-slate-900">Danh sách đoàn</h2>
          <div className="mt-4 space-y-3">
            {groups.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có booking đoàn nào.</p>
            ) : (
              groups.map((group) => (
                <Link
                  key={group.id}
                  to={`/group-bookings/${group.id}`}
                  className="block rounded-xl border border-slate-200 bg-[#fffefb] px-4 py-3 transition hover:border-primary/25 hover:bg-[#faf8f1]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{group.group_name}</p>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      {statusLabel(group.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Tạo lúc: {group.created_at}</p>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
