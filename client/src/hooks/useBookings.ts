import { useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Booking } from '../types'

interface UseBookingsResult {
  bookings: Booking[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useBookings(
  startDate: string,
  endDate: string,
): UseBookingsResult {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function fetchBookings() {
      setLoading(true)
      setError(null)

      try {
        const bookingsQuery = query(
          collection(db, 'bookings'),
          where('checkIn', '<=', endDate),
          where('checkOut', '>=', startDate),
          orderBy('checkIn', 'asc'),
        )

        const snapshot = await getDocs(bookingsQuery)

        if (cancelled) {
          return
        }

        const nextBookings = snapshot.docs.map((document) => ({
          id: document.id,
          ...(document.data() as Omit<Booking, 'id'>),
        }))

        setBookings(nextBookings)
      } catch (queryError) {
        if (cancelled) {
          return
        }

        console.error(queryError)
        setError('Không thể tải booking từ Firestore.')
        setBookings([])
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void fetchBookings()

    return () => {
      cancelled = true
    }
  }, [endDate, reloadTick, startDate])

  return {
    bookings,
    loading,
    error,
    refetch: () => {
      setReloadTick((current) => current + 1)
    },
  }
}