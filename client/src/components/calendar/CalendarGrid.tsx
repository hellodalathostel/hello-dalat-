import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  addDays,
  differenceInCalendarDays,
  format,
  isToday,
  parseISO,
} from 'date-fns'
import { doc, updateDoc } from 'firebase/firestore'
import { vi } from 'date-fns/locale'
import { db } from '../../firebase'
import { ensureRevenueItemsForBooking } from '../../services/revenueSync'
import BookingTooltip from './BookingTooltip'
import type { Booking } from '../../types'

interface CalendarGridProps {
  weekStart: Date
  bookings: Booking[]
  loading: boolean
  error: string | null
  onCreateBooking: (roomId: string, date: string) => void
  onEditBooking: (booking: Booking) => void
}

interface RoomMeta {
  id: string
  typeLabel: string
  capacity: number
}

interface BookingPlacement {
  booking: Booking
  start: number
  span: number
}

interface CellDecoration {
  booking: Booking
  kind: 'eci' | 'lco'
}

const rooms: RoomMeta[] = [
  { id: '101', typeLabel: 'Family', capacity: 4 },
  { id: '102', typeLabel: 'Single', capacity: 1 },
  { id: '202', typeLabel: 'Single', capacity: 1 },
  { id: '103', typeLabel: 'Deluxe Double', capacity: 2 },
  { id: '203', typeLabel: 'Deluxe Double', capacity: 2 },
  { id: '201', typeLabel: 'Deluxe Queen', capacity: 2 },
  { id: '301', typeLabel: 'Standard Double', capacity: 2 },
  { id: '302', typeLabel: 'Standard Double', capacity: 2 },
]

const spanClasses = [
  'col-span-1',
  'col-span-2',
  'col-span-3',
  'col-span-4',
  'col-span-5',
  'col-span-6',
  'col-span-7',
] as const

const statusClasses: Record<Booking['status'], string> = {
  confirmed: 'bg-[#2D5016] text-white',
  checkedin: 'bg-blue-600 text-white',
  checkedout: 'bg-gray-400 text-white',
  cancelled: 'bg-red-400 text-white line-through opacity-60',
  noshow: 'bg-orange-400 text-white opacity-60',
}

const statusOptions: Array<{ value: Booking['status']; label: string }> = [
  { value: 'confirmed', label: '✓ Confirmed' },
  { value: 'checkedin', label: '→ Check In' },
  { value: 'checkedout', label: '✓ Check Out' },
  { value: 'cancelled', label: '✗ Cancel' },
  { value: 'noshow', label: '✗ No Show' },
]

function getWeekDates(weekStart: Date, dayCount: number) {
  return Array.from({ length: dayCount }, (_, index) => addDays(weekStart, index))
}

function getPlacement(
  booking: Booking,
  weekStart: Date,
  dayCount: number,
): BookingPlacement | null {
  const start = Math.max(
    0,
    differenceInCalendarDays(parseISO(booking.checkIn), weekStart),
  )
  const end = Math.min(
    dayCount,
    differenceInCalendarDays(parseISO(booking.checkOut), weekStart),
  )

  if (end <= 0 || start >= dayCount || end <= start) {
    return null
  }

  return {
    booking,
    start,
    span: end - start,
  }
}

function buildLanes(bookings: Booking[], weekStart: Date, dayCount: number) {
  const placements = bookings
    .map((booking) => getPlacement(booking, weekStart, dayCount))
    .filter((placement): placement is BookingPlacement => placement !== null)
    .sort((left, right) => {
      if (left.start === right.start) {
        return right.span - left.span
      }

      return left.start - right.start
    })

  const laneEnds: number[] = []
  const lanes: BookingPlacement[][] = []

  placements.forEach((placement) => {
    const placementEnd = placement.start + placement.span
    const laneIndex = laneEnds.findIndex((laneEnd) => placement.start >= laneEnd)

    if (laneIndex === -1) {
      laneEnds.push(placementEnd)
      lanes.push([placement])
      return
    }

    laneEnds[laneIndex] = placementEnd
    lanes[laneIndex].push(placement)
  })

  return lanes
}

function isBookingOnDay(booking: Booking, dateKey: string) {
  return booking.checkIn <= dateKey && booking.checkOut > dateKey
}

function getCellDecorations(bookings: Booking[], dateKey: string) {
  return bookings.reduce<CellDecoration[]>((decorations, booking) => {
    if (booking.earlyCheckin) {
      const earlyCheckinDate = format(
        addDays(parseISO(booking.checkIn), -1),
        'yyyy-MM-dd',
      )

      if (earlyCheckinDate === dateKey) {
        decorations.push({ booking, kind: 'eci' })
      }
    }

    if (booking.lateCheckout && booking.checkOut === dateKey) {
      decorations.push({ booking, kind: 'lco' })
    }

    return decorations
  }, [])
}

function isGenericBookingCom(booking: Booking) {
  return (
    booking.source === 'booking.com' &&
    booking.guestName === 'Booking.com Guest'
  )
}

function SkeletonRows({ visibleDays }: { visibleDays: number }) {
  const skeletonGridClass =
    visibleDays === 3
      ? 'grid grid-cols-[112px_repeat(3,minmax(88px,1fr))] gap-0'
      : 'grid grid-cols-[180px_repeat(7,minmax(120px,1fr))] gap-0'

  return (
    <div className="space-y-3 p-4">
      {rooms.map((room) => (
        <div
          key={room.id}
          className={skeletonGridClass}
        >
          <div className="sticky left-0 flex h-14 animate-pulse flex-col justify-center border border-r-0 border-slate-200 bg-[#faf8f1] px-4">
            <div className="h-4 w-12 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-20 rounded bg-slate-100" />
          </div>
          <div className={`${visibleDays === 3 ? 'col-span-3 grid-cols-3' : 'col-span-7 grid-cols-7'} grid`}>
            {Array.from({ length: visibleDays }).map((_, index) => (
              <div
                key={`${room.id}-${index}`}
                className="h-14 animate-pulse border border-slate-200 bg-white"
              >
                <div className="m-2 h-6 rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CalendarGrid({
  weekStart,
  bookings,
  loading,
  error,
  onCreateBooking,
  onEditBooking,
}: CalendarGridProps) {
  const [visibleDays, setVisibleDays] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 3 : 7,
  )
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null)
  const [openStatusMenuId, setOpenStatusMenuId] = useState<string | null>(null)
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null)
  const [statusOverrides, setStatusOverrides] = useState<
    Record<string, Booking['status']>
  >({})
  const weekDates = getWeekDates(weekStart, visibleDays)
  const spanClassMap = spanClasses.slice(0, visibleDays)
  const effectiveStatusById = useMemo(() => {
    const map: Record<string, Booking['status']> = {}

    bookings.forEach((booking) => {
      map[booking.id] = statusOverrides[booking.id] ?? booking.status
    })

    return map
  }, [bookings, statusOverrides])

  const visibleBookings = useMemo(
    () =>
      bookings.filter(
        (booking) => (effectiveStatusById[booking.id] ?? booking.status) !== 'cancelled',
      ),
    [bookings, effectiveStatusById],
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)')
    const applyView = (isMobile: boolean) => {
      setVisibleDays(isMobile ? 3 : 7)
    }

    applyView(mediaQuery.matches)

    const onChange = (event: MediaQueryListEvent) => {
      applyView(event.matches)
    }

    mediaQuery.addEventListener('change', onChange)

    return () => {
      mediaQuery.removeEventListener('change', onChange)
    }
  }, [])

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Element | null

      if (target?.closest('.status-menu-root')) {
        return
      }

      setOpenStatusMenuId(null)
    }

    document.addEventListener('click', onDocumentClick)

    return () => {
      document.removeEventListener('click', onDocumentClick)
    }
  }, [])

  async function handleChangeStatus(
    booking: Booking,
    nextStatus: Booking['status'],
  ) {
    if (effectiveStatusById[booking.id] === nextStatus) {
      setOpenStatusMenuId(null)
      return
    }

    setUpdatingStatusId(booking.id)

    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      })

      if (nextStatus === 'checkedout') {
        await ensureRevenueItemsForBooking({
          ...booking,
          status: nextStatus,
        })
      }

      setStatusOverrides((current) => ({
        ...current,
        [booking.id]: nextStatus,
      }))
      setOpenStatusMenuId(null)
    } catch (error) {
      console.error(error)
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const gridClass =
    visibleDays === 3
      ? 'grid grid-cols-[112px_repeat(3,minmax(88px,1fr))]'
      : 'grid grid-cols-[180px_repeat(7,minmax(120px,1fr))]'

  const minWidthClass = visibleDays === 3 ? 'min-w-[430px]' : 'min-w-[1120px]'

  return (
    <section className="overflow-hidden rounded-[28px] border border-primary/10 bg-white shadow-sm">
      {error ? (
        <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 md:px-6">
          {error}
        </div>
      ) : null}

      {!loading && visibleBookings.length === 0 ? (
        <div className="border-b border-primary/10 bg-[#faf8f1] px-4 py-3 text-sm text-slate-600 md:px-6">
          Không có booking nào trong tuần này
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <div className={minWidthClass}>
          <div className={`${gridClass} border-b border-primary/10 bg-[#f6f3e8]`}>
            <div className="sticky left-0 z-20 flex items-center border-r border-primary/10 bg-[#f6f3e8] px-4 py-4 text-sm font-semibold text-slate-700 md:px-6">
              Phòng
            </div>
            {weekDates.map((date) => (
              <div
                key={date.toISOString()}
                className={`border-l border-primary/10 px-2 py-4 text-center ${
                  isToday(date) ? 'bg-primary/10' : ''
                }`}
              >
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                  {format(date, 'EEE', { locale: vi })}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 md:text-base">
                  {format(date, 'dd')}
                </p>
              </div>
            ))}
          </div>

          {loading ? <SkeletonRows visibleDays={visibleDays} /> : null}

          {!loading
            ? rooms.map((room) => {
                const roomBookings = visibleBookings.filter(
                  (booking) => booking.roomId === room.id,
                )
                const roomHasActiveTooltip = roomBookings.some(
                  (booking) => booking.id === activeBookingId,
                )
                const lanes = buildLanes(roomBookings, weekStart, visibleDays)
                const dayCells = weekDates.map((date) => {
                  const dateKey = format(date, 'yyyy-MM-dd')
                  const mainBookings = roomBookings.filter((booking) =>
                    isBookingOnDay(booking, dateKey),
                  )
                  const decorations = getCellDecorations(roomBookings, dateKey)
                  const hasConflict = decorations.some((decoration) =>
                    mainBookings.some((booking) => booking.id !== decoration.booking.id),
                  )

                  return {
                    date,
                    dateKey,
                    decorations,
                    hasConflict,
                  }
                })

                return (
                  <div
                    key={room.id}
                    className={`${gridClass} ${roomHasActiveTooltip ? 'relative z-40' : ''}`}
                  >
                    <div className="sticky left-0 z-10 flex min-h-[54px] items-center border-b border-r border-primary/10 bg-[#fffdf8] px-4 py-2 md:px-6">
                      <span className="text-base font-semibold text-slate-900">{room.id}</span>
                    </div>

                    <div
                      className={`${
                        visibleDays === 3 ? 'col-span-3' : 'col-span-7'
                      } border-b border-primary/10`}
                    >
                      <div className="relative">
                        <div
                          className={`absolute inset-0 grid ${
                            visibleDays === 3 ? 'grid-cols-3' : 'grid-cols-7'
                          }`}
                        >
                          {dayCells.map((cell) => (
                            <button
                              key={`${room.id}-${cell.date.toISOString()}`}
                              type="button"
                              onClick={() => {
                                onCreateBooking(room.id, cell.dateKey)
                              }}
                              title={cell.hasConflict ? 'Xung đột lịch!' : undefined}
                              className={`border-l ${
                                cell.hasConflict
                                  ? 'border-2 border-red-500'
                                  : 'border-primary/10'
                              } ${
                                isToday(cell.date) ? 'bg-primary/5' : 'bg-[#fffdf8]'
                              } hover:bg-primary/10 transition`}
                              aria-label={`Tạo booking phòng ${room.id} ngày ${format(cell.date, 'dd/MM/yyyy')}`}
                            />
                          ))}
                        </div>

                        <div
                          className={`pointer-events-none absolute inset-0 z-[5] grid ${
                            visibleDays === 3 ? 'grid-cols-3' : 'grid-cols-7'
                          }`}
                        >
                          {dayCells.map((cell) => {
                            const earlyCheckinDecoration = cell.decorations.find(
                              (decoration) => decoration.kind === 'eci',
                            )
                            const lateCheckoutDecoration = cell.decorations.find(
                              (decoration) => decoration.kind === 'lco',
                            )

                            return (
                              <div
                                key={`${room.id}-${cell.dateKey}-decorations`}
                                title={cell.hasConflict ? 'Xung đột lịch!' : undefined}
                                className={`relative border-l ${
                                  cell.hasConflict
                                    ? 'border-2 border-red-500'
                                    : 'border-primary/10'
                                }`}
                              >
                                {lateCheckoutDecoration ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      onEditBooking(lateCheckoutDecoration.booking)
                                    }}
                                    className="pointer-events-auto absolute bottom-1 left-1 flex h-6 w-[calc(50%-0.25rem)] items-center justify-center rounded-md bg-purple-300 text-[11px] font-semibold text-purple-900 shadow-sm"
                                  >
                                    LCO
                                  </button>
                                ) : null}

                                {earlyCheckinDecoration ? (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      onEditBooking(earlyCheckinDecoration.booking)
                                    }}
                                    className="pointer-events-auto absolute bottom-1 right-1 flex h-6 w-[calc(50%-0.25rem)] items-center justify-center rounded-md bg-amber-300 text-[11px] font-semibold text-amber-900 shadow-sm"
                                  >
                                    ECI
                                  </button>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>

                        <div className="relative z-10 flex min-h-[54px] flex-col gap-1.5 p-1.5 pointer-events-none">
                          {lanes.length === 0 ? (
                            <div className="h-6" />
                          ) : (
                            lanes.map((lane, laneIndex) => {
                              let currentColumn = 0

                              return (
                                <div
                                  key={`${room.id}-lane-${laneIndex}`}
                                  className={`grid gap-1 ${
                                    visibleDays === 3 ? 'grid-cols-3' : 'grid-cols-7'
                                  }`}
                                >
                                  {lane.map((placement) => {
                                    const gap = placement.start - currentColumn
                                    const isBookingCom = isGenericBookingCom(placement.booking)
                                    const bookingLabel = isBookingCom
                                      ? 'Booking.com'
                                      : placement.booking.guestName
                                    const bookingBarClass = isBookingCom
                                      ? statusClasses.confirmed
                                      : statusClasses[
                                          effectiveStatusById[placement.booking.id] ?? placement.booking.status
                                        ]
                                    const gapNode =
                                      gap > 0 ? (
                                        <div
                                          key={`${room.id}-${placement.booking.id}-gap-${currentColumn}`}
                                          className={spanClassMap[gap - 1]}
                                        />
                                      ) : null

                                    currentColumn = placement.start + placement.span

                                    return (
                                      <Fragment key={placement.booking.id}>
                                        {gapNode}
                                        <div className={spanClassMap[placement.span - 1]}>
                                          <div className={`relative ${activeBookingId === placement.booking.id ? 'z-50' : ''}`}>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                onEditBooking(placement.booking)
                                              }}
                                              onMouseEnter={() => {
                                                setActiveBookingId(placement.booking.id)
                                              }}
                                              onMouseLeave={() => {
                                                setActiveBookingId((current) =>
                                                  current === placement.booking.id
                                                    ? null
                                                    : current,
                                                )
                                              }}
                                              className={`group flex h-7 w-full items-center rounded-lg px-2.5 pr-9 text-left text-xs font-medium shadow-sm transition hover:brightness-105 pointer-events-auto ${bookingBarClass}`}
                                            >
                                              {isBookingCom ? (
                                                <span className="mr-2 inline-flex h-4 min-w-4 items-center justify-center rounded bg-white/30 px-1 text-[10px] font-semibold leading-none text-white">
                                                  B.
                                                </span>
                                              ) : null}
                                              <span className="truncate">
                                                {bookingLabel}
                                              </span>
                                            </button>

                                            <div className="status-menu-root pointer-events-auto absolute right-1 top-1/2 z-20 -translate-y-1/2">
                                              <button
                                                type="button"
                                                aria-label="Đổi trạng thái"
                                                onClick={(event) => {
                                                  event.stopPropagation()
                                                  setOpenStatusMenuId((current) =>
                                                    current === placement.booking.id
                                                      ? null
                                                      : placement.booking.id,
                                                  )
                                                }}
                                                className="rounded-md bg-black/15 px-1.5 py-0.5 text-xs font-semibold text-white opacity-0 transition hover:bg-black/30 focus:opacity-100 group-hover:opacity-100"
                                              >
                                                ...
                                              </button>

                                              {openStatusMenuId === placement.booking.id ? (
                                                <div className="absolute right-0 top-full mt-1 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                                  {statusOptions.map((option) => {
                                                    const currentStatus =
                                                      effectiveStatusById[placement.booking.id] ??
                                                      placement.booking.status

                                                    return (
                                                      <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={(event) => {
                                                          event.stopPropagation()
                                                          void handleChangeStatus(
                                                            placement.booking,
                                                            option.value,
                                                          )
                                                        }}
                                                        disabled={updatingStatusId === placement.booking.id}
                                                        className={`block w-full px-3 py-1.5 text-left text-xs transition hover:bg-slate-50 disabled:opacity-50 ${
                                                          option.value === currentStatus
                                                            ? 'bg-primary/10 font-semibold text-primary'
                                                            : 'text-slate-700'
                                                        }`}
                                                      >
                                                        {option.label}
                                                      </button>
                                                    )
                                                  })}
                                                </div>
                                              ) : null}
                                            </div>

                                            {activeBookingId === placement.booking.id ? (
                                              <BookingTooltip
                                                booking={placement.booking}
                                                onOpenDetail={(bookingId) => {
                                                  const booking = bookings.find(
                                                    (item) => item.id === bookingId,
                                                  )

                                                  if (booking) {
                                                    onEditBooking(booking)
                                                  }
                                                }}
                                              />
                                            ) : null}
                                          </div>
                                        </div>
                                      </Fragment>
                                    )
                                  })}

                                  {currentColumn < visibleDays ? (
                                    <div className={spanClassMap[visibleDays - currentColumn - 1]} />
                                  ) : null}
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            : null}
        </div>
      </div>
    </section>
  )
}