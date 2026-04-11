import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth, subDays } from 'date-fns'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { db } from '../firebase'
import type { Booking, ExpenseItem, RevenueCategory, RevenueItem } from '../types'
import {
  type DbBooking,
  mapBookingFromDb,
  mapExpenseItemFromDb,
  mapRevenueItemFromDb,
  type DbExpenseItem,
  type DbRevenueItem,
} from '../utils/firestoreMappers'

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
  refetch: () => void
}

interface OverviewDataState {
  rangeBookings: Booking[]
  monthRevenue: RevenueItem[]
  monthExpenses: ExpenseItem[]
}

const TOTAL_ROOMS = 8
const revenueCategoryLabels: Record<RevenueCategory, string> = {
  room: 'Room',
  breakfast: 'Breakfast',
  scooter: 'Scooter',
  tour: 'Tour',
  other: 'Other',
}
const emptyOverviewDataState: OverviewDataState = {
  rangeBookings: [],
  monthRevenue: [],
  monthExpenses: [],
}

function isActiveBooking(booking: Booking) {
  return booking.status !== 'cancelled' && booking.status !== 'noshow'
}

function includesDate(booking: Booking, date: string) {
  return booking.checkIn <= date && booking.checkOut > date
}

function revenueTotal(item: RevenueItem) {
  return Number(item.amount || 0) + Number(item.cardSurcharge || 0)
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
  const todayDate = new Date()
  const today = format(todayDate, 'yyyy-MM-dd')
  const monthStart = format(startOfMonth(todayDate), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(todayDate), 'yyyy-MM-dd')
  const thirtyDaysStart = format(subDays(todayDate, 29), 'yyyy-MM-dd')

  const [overviewData, setOverviewData] = useState<OverviewDataState>(emptyOverviewDataState)
  const [{ loading, error }, dispatch] = useReducer(statusReducer, { loading: true, error: null })
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function fetchOverviewData() {
      dispatch({ type: 'INIT' })

      try {
        const [rangeBookingsSnapshot, monthRevenueSnapshot, monthExpensesSnapshot] = await Promise.all([
          getDocs(
            query(
              collection(db, 'bookings'),
              where('checkIn', '<=', today),
              where('checkOut', '>=', thirtyDaysStart),
              orderBy('checkIn', 'asc'),
            ),
          ),
          getDocs(
            query(
              collection(db, 'revenue_items'),
              where('date', '>=', monthStart),
              where('date', '<=', monthEnd),
            ),
          ),
          getDocs(
            query(
              collection(db, 'expenses'),
              where('date', '>=', monthStart),
              where('date', '<=', monthEnd),
            ),
          ),
        ])

        if (cancelled) {
          return
        }

        setOverviewData({
          rangeBookings: rangeBookingsSnapshot.docs.map((document) => mapBookingFromDb(document.id, document.data() as DbBooking)),
          monthRevenue: monthRevenueSnapshot.docs.map((document) => mapRevenueItemFromDb(document.id, document.data() as DbRevenueItem)),
          monthExpenses: monthExpensesSnapshot.docs.map((document) => mapExpenseItemFromDb(document.id, document.data() as DbExpenseItem)),
        })
        dispatch({ type: 'READY' })
      } catch (fetchError) {
        if (cancelled) {
          return
        }

        console.error(fetchError)
        setOverviewData(emptyOverviewDataState)
        dispatch({ type: 'ERROR', message: 'Không thể tải dữ liệu tổng quan.' })
      }
    }

    void fetchOverviewData()

    return () => {
      cancelled = true
    }
  }, [monthEnd, monthStart, reloadTick, thirtyDaysStart, today])

  const checkInsToday = useMemo(
    () => sortBookingsByRoom(overviewData.rangeBookings.filter((booking) => booking.checkIn === today)),
    [overviewData.rangeBookings, today],
  )

  const checkOutsToday = useMemo(
    () => sortBookingsByRoom(overviewData.rangeBookings.filter((booking) => booking.checkOut === today)),
    [overviewData.rangeBookings, today],
  )

  const occupancySeries = useMemo(() => {
    const dates = eachDayOfInterval({
      start: parseISO(thirtyDaysStart),
      end: parseISO(today),
    })

    return dates.map((date) => {
      const day = format(date, 'yyyy-MM-dd')
      const occupiedRooms = new Set(
        overviewData.rangeBookings
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
  }, [overviewData.rangeBookings, thirtyDaysStart, today])

  const metrics = useMemo<OverviewMetrics>(() => {
    const todayOccupied = new Set(
      overviewData.rangeBookings
        .filter((booking) => isActiveBooking(booking) && includesDate(booking, today))
        .map((booking) => booking.roomId),
    ).size

    const revenueTodayPaid = overviewData.monthRevenue
      .filter((item) => item.date === today && item.status === 'paid')
      .reduce((sum, item) => sum + revenueTotal(item), 0)

    const revenueMonthPaid = overviewData.monthRevenue
      .filter((item) => item.status === 'paid')
      .reduce((sum, item) => sum + revenueTotal(item), 0)

    const expenseMonth = overviewData.monthExpenses.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    )

    const unpaidRevenue = overviewData.monthRevenue.filter((item) => item.status === 'unpaid')
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
  }, [overviewData.monthExpenses, overviewData.monthRevenue, overviewData.rangeBookings, today])

  const revenueBreakdown = useMemo<RevenueBreakdownItem[]>(() => {
    const grouped: Record<RevenueCategory, number> = {
      room: 0,
      breakfast: 0,
      scooter: 0,
      tour: 0,
      other: 0,
    }

    overviewData.monthRevenue
      .filter((item) => item.status === 'paid')
      .forEach((item) => {
        grouped[item.category] += revenueTotal(item)
      })

    return (Object.keys(grouped) as RevenueCategory[]).map((category) => ({
      category,
      label: revenueCategoryLabels[category],
      amount: grouped[category],
    }))
  }, [overviewData.monthRevenue])

  return {
    loading,
    error,
    metrics,
    occupancySeries,
    revenueBreakdown,
    checkInsToday,
    checkOutsToday,
    today,
    refetch: () => {
      setReloadTick((current) => current + 1)
    },
  }
}
