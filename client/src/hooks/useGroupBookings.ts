import { format, subDays } from 'date-fns'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Booking, GroupBooking } from '../types'
import { mapBookingFromDb, mapGroupBookingFromDb, type DbBooking, type DbGroupBooking } from '../utils/firestoreMappers'

export interface GroupBookingRoomInput {
  roomId: string
  checkIn: string
  checkOut: string
  guests: number
  roomRate: number
  breakfastIncluded: boolean
}

interface CreateGroupBookingInput {
  groupName: string
  note?: string
  rooms: GroupBookingRoomInput[]
}

interface GroupBookingWithRooms {
  group: GroupBooking
  rooms: Booking[]
}

interface UseGroupBookingsResult {
  groups: GroupBooking[]
  bookings: Booking[]
  loading: boolean
  error: string | null
  createGroupBooking: (input: CreateGroupBookingInput) => Promise<string>
  getGroupBookingDetail: (groupId: string) => Promise<GroupBookingWithRooms | null>
  updateSingleBookingStatus: (groupId: string, bookingId: string, status: Booking['status']) => Promise<void>
  cancelGroupBooking: (groupId: string) => Promise<void>
  refetch: () => Promise<void>
}

const BREAKFAST_PRICE = 35000

function toNights(checkIn: string, checkOut: string) {
  const inDate = new Date(`${checkIn}T00:00:00`)
  const outDate = new Date(`${checkOut}T00:00:00`)
  const diff = Math.round((outDate.getTime() - inDate.getTime()) / 86400000)
  return diff > 0 ? diff : 1
}

function toGroupStatus(rooms: Booking[]): GroupBooking['status'] {
  if (rooms.length === 0) {
    return 'confirmed'
  }

  if (rooms.every((room) => room.status === 'cancelled')) {
    return 'cancelled'
  }

  if (rooms.every((room) => room.status === 'checkedout')) {
    return 'checked_out'
  }

  if (rooms.some((room) => room.status === 'checkedin')) {
    return 'checked_in'
  }

  return 'confirmed'
}

export function useGroupBookings(): UseGroupBookingsResult {
  const [groups, setGroups] = useState<GroupBooking[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    const windowStart = format(subDays(new Date(), 30), 'yyyy-MM-dd')

    try {
      const [groupSnapshot, bookingSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'group_bookings'), orderBy('created_at', 'desc'), limit(50))),
        getDocs(query(collection(db, 'bookings'), where('checkOut', '>=', windowStart), orderBy('checkOut', 'asc'))),
      ])

      const nextGroups = groupSnapshot.docs.map((item) => ({
        ...mapGroupBookingFromDb(item.id, item.data() as DbGroupBooking),
      }))

      const nextBookings = bookingSnapshot.docs.map((item) => ({
        ...mapBookingFromDb(item.id, item.data() as DbBooking),
      }))

      setGroups(nextGroups)
      setBookings(nextBookings)
    } catch (fetchError) {
      console.error(fetchError)
      setError('Không thể tải dữ liệu booking đoàn.')
      setGroups([])
      setBookings([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const createGroupBooking = useCallback(async (input: CreateGroupBookingInput) => {
    const now = new Date().toISOString()
    const createdGroup = await addDoc(collection(db, 'group_bookings'), {
      group_name: input.groupName.trim(),
      created_at: now,
      status: 'confirmed',
      note: input.note?.trim() || '',
    })

    const batch = writeBatch(db)

    input.rooms.forEach((room) => {
      const nights = toNights(room.checkIn, room.checkOut)
      const roomSubtotal = nights * room.roomRate
      const breakfastSubtotal = room.breakfastIncluded
        ? nights * room.guests * BREAKFAST_PRICE
        : 0
      const totalAmount = roomSubtotal + breakfastSubtotal

      const bookingRef = doc(collection(db, 'bookings'))
      batch.set(bookingRef, {
        group_booking_id: createdGroup.id,
        roomId: room.roomId,
        guestName: input.groupName.trim(),
        guestPhone: '',
        guestEmail: '',
        nationality: 'VN',
        checkIn: room.checkIn,
        checkOut: room.checkOut,
        earlyCheckin: false,
        lateCheckout: false,
        nights,
        adults: room.guests,
        children: 0,
        roomRate: room.roomRate,
        totalAmount,
        services: room.breakfastIncluded
          ? [{
              id: `bf-${Date.now().toString()}-${Math.random().toString(36).slice(2, 8)}`,
              name: 'Breakfast (Group)',
              quantity: nights * room.guests,
              unitPrice: BREAKFAST_PRICE,
              total: breakfastSubtotal,
            }]
          : [],
        discount: 0,
        discountNote: '',
        depositPaid: 0,
        paymentStatus: 'pending',
        paymentMethod: 'cash',
        source: 'Group booking',
        breakfastIncluded: false,
        status: 'confirmed',
        notes: input.note?.trim() || '',
        icalEventId: null,
        createdAt: now,
        updatedAt: now,
      })
    })

    await batch.commit()
    await fetchData()

    return createdGroup.id
  }, [fetchData])

  const getGroupBookingDetail = useCallback(async (groupId: string): Promise<GroupBookingWithRooms | null> => {
    const groupRef = doc(db, 'group_bookings', groupId)
    const groupDoc = await getDoc(groupRef)

    if (!groupDoc.exists()) {
      return null
    }

    const roomsSnapshot = await getDocs(
      query(collection(db, 'bookings'), where('group_booking_id', '==', groupId)),
    )

    const rooms = roomsSnapshot.docs.map((item) => ({
      ...mapBookingFromDb(item.id, item.data() as DbBooking),
    }))
      .sort((left, right) => {
        const byCheckIn = left.checkIn.localeCompare(right.checkIn)
        if (byCheckIn !== 0) {
          return byCheckIn
        }

        return left.roomId.localeCompare(right.roomId)
      })

    return {
      group: {
        ...mapGroupBookingFromDb(groupDoc.id, groupDoc.data() as DbGroupBooking),
      },
      rooms,
    }
  }, [])

  const syncGroupStatus = useCallback(async (groupId: string) => {
    const linkedBookingsSnapshot = await getDocs(
      query(collection(db, 'bookings'), where('group_booking_id', '==', groupId)),
    )

    const linkedBookings = linkedBookingsSnapshot.docs.map((item) => ({
      ...mapBookingFromDb(item.id, item.data() as DbBooking),
    }))

    await updateDoc(doc(db, 'group_bookings', groupId), {
      status: toGroupStatus(linkedBookings),
      updatedAt: new Date().toISOString(),
    })
  }, [])

  const updateSingleBookingStatus = useCallback(async (groupId: string, bookingId: string, status: Booking['status']) => {
    await updateDoc(doc(db, 'bookings', bookingId), {
      status,
      updatedAt: new Date().toISOString(),
    })

    await syncGroupStatus(groupId)
    await fetchData()
  }, [fetchData, syncGroupStatus])

  const cancelGroupBooking = useCallback(async (groupId: string) => {
    const linkedBookingsSnapshot = await getDocs(
      query(collection(db, 'bookings'), where('group_booking_id', '==', groupId)),
    )

    const batch = writeBatch(db)
    linkedBookingsSnapshot.docs.forEach((item) => {
      batch.update(doc(db, 'bookings', item.id), {
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      })
    })

    batch.update(doc(db, 'group_bookings', groupId), {
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    })

    await batch.commit()
    await fetchData()
  }, [fetchData])

  return useMemo(
    () => ({
      groups,
      bookings,
      loading,
      error,
      createGroupBooking,
      getGroupBookingDetail,
      updateSingleBookingStatus,
      cancelGroupBooking,
      refetch: fetchData,
    }),
    [groups, bookings, loading, error, createGroupBooking, getGroupBookingDetail, updateSingleBookingStatus, cancelGroupBooking, fetchData],
  )
}
