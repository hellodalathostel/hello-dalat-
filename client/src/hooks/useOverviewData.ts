import { eachDayOfInterval, endOfMonth, format, startOfMonth, subDays } from 'date-fns'
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { db } from '../firebase'
import type { Booking, ExpenseItem, RevenueCategory, RevenueItem } from '../types'

interface OccupancyPoint {
  date: string
  label: string
  occupancyRate: number
  occupiedRooms: number
}

interface RevenueBreakdownItem {
  category: RevenueCategory
  label: string
  amount: number
}

interface OverviewMetrics {
  occupiedToday: number
  totalRooms: number
  revenueTodayPaid: number
  revenueMonthPaid: number
  expenseMonth: number
  profitMonth: number
  unpaidTotal: number
  unpaidCount: number
}

interface UseOverviewDataResult {
  loading: boolean
  error: string | null
  metrics: OverviewMetrics
  occupancySeries: OccupancyPoint[]
  revenueBreakdown: RevenueBreakdownItem[]
  checkInsToday: Booking[]
  checkOutsToday: Booking[]
  today: string
}

const TOTAL_ROOMS = 8
const revenueCategoryLabels: Record<RevenueCategory, string> = {
  room: 'Room',
  breakfast: 'Breakfast',
  scooter: 'Scooter',
  tour: 'Tour',
  other: 'Other',
}

function isActiveBooking(booking: Booking) {
  return booking.status !== 'cancelled' && booking.status !== 'noshow'
}

function includesDate(booking: Booking, date: string) {
  return booking.checkIn <= date && booking.checkOut > date
}

function revenueTotal(item: RevenueItem) {
  return Number(item.amount || 0) + Number(item.card_surcharge || 0)
}

function sortBookingsByRoom(items: Booking[]) {
  return [...items].sort((a, b) => a.roomId.localeCompare(b.roomId))
}

type OverviewStatus = { loading: boolean; error: string | null }
type OverviewStatusAction =
  | { type: 'INIT' }
  | { type: 'READY' }
  | { type: 'ERROR'; message: string }

function statusReducer(_state: OverviewStatus, action: OverviewStatusAction): OverviewStatus {
  switch (action.type) {
    case 'INIT':
      return { loading: true, error: null }
    case 'READY':
      return { loading: false, error: null }
    case 'ERROR':
      return { loading: false, error: action.message }
    default:
      return _state
  }
}

export function useOverviewData(): UseOverviewDataResult {
  const todayDate = useMemo(() => new Date(), [])
  const today = useMemo(() => format(todayDate, 'yyyy-MM-dd'), [todayDate])
  const monthStart = useMemo(() => format(startOfMonth(todayDate), 'yyyy-MM-dd'), [todayDate])
  const monthEnd = useMemo(() => format(endOfMonth(todayDate), 'yyyy-MM-dd'), [todayDate])
  const thirtyDaysStart = useMemo(() => format(subDays(todayDate, 29), 'yyyy-MM-dd'), [todayDate])

  const [rangeBookings, setRangeBookings] = useState<Booking[]>([])
  const [monthRevenue, setMonthRevenue] = useState<RevenueItem[]>([])
  const [monthExpenses, setMonthExpenses] = useState<ExpenseItem[]>([])
  const [unpaidRevenue, setUnpaidRevenue] = useState<RevenueItem[]>([])
  const [checkInsToday, setCheckInsToday] = useState<Booking[]>([])
  const [checkOutsToday, setCheckOutsToday] = useState<Booking[]>([])
  const [{ loading, error }, dispatch] = useReducer(statusReducer, { loading: true, error: null })

  useEffect(() => {
    dispatch({ type: 'INIT' })

    const ready = {
      range: false,
      revenue: false,
      expenses: false,
      unpaid: false,
      checkIn: false,
      checkOut: false,
    }

    const finishIfReady = () => {
      if (Object.values(ready).every(Boolean)) {
        dispatch({ type: 'READY' })
      }
    }

    const unsubRangeBookings = onSnapshot(
      query(
        collection(db, 'bookings'),
        where('checkIn', '<=', today),
        where('checkOut', '>=', thirtyDaysStart),
        orderBy('checkIn', 'asc'),
      ),
      (snapshot) => {
        setRangeBookings(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...(document.data() as Omit<Booking, 'id'>),
          })),
        )
        ready.range = true
        finishIfReady()
      },
      (snapshotError) => {
        console.error(snapshotError)
        setRangeBookings([])
        dispatch({ type: 'ERROR', message: 'Không thể tải dữ liệu công suất phòng.' })
        ready.range = true
        finishIfReady()
      },
    )

    const unsubMonthRevenue = onSnapshot(
      query(
        collection(db, 'revenue_items'),
        where('date', '>=', monthStart),
        where('date', '<=', monthEnd),
      ),
      (snapshot) => {
        setMonthRevenue(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...(document.data() as Omit<RevenueItem, 'id'>),
          })),
        )
        ready.revenue = true
        finishIfReady()
      },
      (snapshotError) => {
        console.error(snapshotError)
        setMonthRevenue([])
        dispatch({ type: 'ERROR', message: 'Không thể tải dữ liệu doanh thu.' })
        ready.revenue = true
        finishIfReady()
      },
    )

    const unsubMonthExpenses = onSnapshot(
      query(
        collection(db, 'expenses'),
        where('date', '>=', monthStart),
        where('date', '<=', monthEnd),
      ),
      (snapshot) => {
        setMonthExpenses(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...(document.data() as Omit<ExpenseItem, 'id'>),
          })),
        )
        ready.expenses = true
        finishIfReady()
      },
      (snapshotError) => {
        console.error(snapshotError)
        setMonthExpenses([])
        dispatch({ type: 'ERROR', message: 'Không thể tải dữ liệu chi phí.' })
        ready.expenses = true
        finishIfReady()
      },
    )

    const unsubUnpaidRevenue = onSnapshot(
      query(collection(db, 'revenue_items'), where('status', '==', 'unpaid')),
      (snapshot) => {
        setUnpaidRevenue(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...(document.data() as Omit<RevenueItem, 'id'>),
          })),
        )
        ready.unpaid = true
        finishIfReady()
      },
      (snapshotError) => {
        console.error(snapshotError)
        setUnpaidRevenue([])
        dispatch({ type: 'ERROR', message: 'Không thể tải dữ liệu công nợ.' })
        ready.unpaid = true
        finishIfReady()
      },
    )

    const unsubCheckIns = onSnapshot(
      query(collection(db, 'bookings'), where('checkIn', '==', today)),
      (snapshot) => {
        const items = snapshot.docs.map((document) => ({
          id: document.id,
          ...(document.data() as Omit<Booking, 'id'>),
        }))

        setCheckInsToday(sortBookingsByRoom(items))
        ready.checkIn = true
        finishIfReady()
      },
      (snapshotError) => {
        console.error(snapshotError)
        setCheckInsToday([])
        dispatch({ type: 'ERROR', message: 'Không thể tải danh sách check-in hôm nay.' })
        ready.checkIn = true
        finishIfReady()
      },
    )

    const unsubCheckOuts = onSnapshot(
      query(collection(db, 'bookings'), where('checkOut', '==', today)),
      (snapshot) => {
        const items = snapshot.docs.map((document) => ({
          id: document.id,
          ...(document.data() as Omit<Booking, 'id'>),
        }))

        setCheckOutsToday(sortBookingsByRoom(items))
        ready.checkOut = true
        finishIfReady()
      },
      (snapshotError) => {
        console.error(snapshotError)
        setCheckOutsToday([])
        dispatch({ type: 'ERROR', message: 'Không thể tải danh sách check-out hôm nay.' })
        ready.checkOut = true
        finishIfReady()
      },
    )

    return () => {
      unsubRangeBookings()
      unsubMonthRevenue()
      unsubMonthExpenses()
      unsubUnpaidRevenue()
      unsubCheckIns()
      unsubCheckOuts()
    }
  }, [monthEnd, monthStart, thirtyDaysStart, today])

  const occupancySeries = useMemo(() => {
    const dates = eachDayOfInterval({
      start: subDays(todayDate, 29),
      end: todayDate,
    })

    return dates.map((date) => {
      const day = format(date, 'yyyy-MM-dd')
      const occupiedRooms = new Set(
        rangeBookings
          .filter((booking) => isActiveBooking(booking) && includesDate(booking, day))
          .map((booking) => booking.roomId),
      ).size

      return {
        date: day,
        label: format(date, 'dd/MM'),
        occupiedRooms,
        occupancyRate: Number(((occupiedRooms / TOTAL_ROOMS) * 100).toFixed(1)),
      }
    })
  }, [rangeBookings, todayDate])

  const metrics = useMemo<OverviewMetrics>(() => {
    const todayOccupied = new Set(
      rangeBookings
        .filter((booking) => isActiveBooking(booking) && includesDate(booking, today))
        .map((booking) => booking.roomId),
    ).size

    const revenueTodayPaid = monthRevenue
      .filter((item) => item.date === today && item.status === 'paid')
      .reduce((sum, item) => sum + revenueTotal(item), 0)

    const revenueMonthPaid = monthRevenue
      .filter((item) => item.status === 'paid')
      .reduce((sum, item) => sum + revenueTotal(item), 0)

    const expenseMonth = monthExpenses.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    )

    const unpaidTotal = unpaidRevenue.reduce((sum, item) => sum + revenueTotal(item), 0)

    return {
      occupiedToday: todayOccupied,
      totalRooms: TOTAL_ROOMS,
      revenueTodayPaid,
      revenueMonthPaid,
      expenseMonth,
      profitMonth: revenueMonthPaid - expenseMonth,
      unpaidTotal,
      unpaidCount: unpaidRevenue.length,
    }
  }, [monthExpenses, monthRevenue, rangeBookings, today, unpaidRevenue])

  const revenueBreakdown = useMemo<RevenueBreakdownItem[]>(() => {
    const grouped: Record<RevenueCategory, number> = {
      room: 0,
      breakfast: 0,
      scooter: 0,
      tour: 0,
      other: 0,
    }

    monthRevenue
      .filter((item) => item.status === 'paid')
      .forEach((item) => {
        grouped[item.category] += revenueTotal(item)
      })

    return (Object.keys(grouped) as RevenueCategory[]).map((category) => ({
      category,
      label: revenueCategoryLabels[category],
      amount: grouped[category],
    }))
  }, [monthRevenue])

  return {
    loading,
    error,
    metrics,
    occupancySeries,
    revenueBreakdown,
    checkInsToday,
    checkOutsToday,
    today,
  }
}
