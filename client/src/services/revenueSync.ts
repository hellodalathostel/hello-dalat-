import { collection, doc, getDocs, query, where, writeBatch } from 'firebase/firestore'
import type { Booking } from '../types'
import { db } from '../firebase'
import { buildLineItems } from '../utils/buildLineItems.js'

function normalizeCategory(label: string) {
  const lowered = label.toLowerCase()
  if (lowered.includes('breakfast') || lowered.includes('điểm tâm')) {
    return 'breakfast' as const
  }
  if (lowered.includes('scooter') || lowered.includes('xe máy')) {
    return 'scooter' as const
  }
  if (lowered.includes('tour')) {
    return 'tour' as const
  }
  if (lowered.includes('room') || lowered.includes('phòng')) {
    return 'room' as const
  }
  return 'other' as const
}

export async function ensureRevenueItemsForBooking(booking: Booking) {
  const existingSnapshot = await getDocs(
    query(collection(db, 'revenue_items'), where('booking_id', '==', booking.id)),
  )

  const existingKeys = new Set(
    existingSnapshot.docs.map((item) => {
      const data = item.data() as { category?: string; description?: string }
      return `${data.category || ''}::${data.description || ''}`
    }),
  )

  const payment_method = booking.paymentMethod === 'card' ? 'card' : 'cash'
  const status = booking.paymentStatus === 'paid' ? 'paid' : 'unpaid'
  const date = booking.checkOut || booking.checkIn
  const now = new Date().toISOString()
  const lineItems = buildLineItems(booking)

  const batch = writeBatch(db)
  let hasNewItems = false

  for (const item of lineItems) {
    if (!item || Number(item.total || 0) <= 0) {
      continue
    }

    const category = normalizeCategory(item.label_en || item.label_vi || '')
    const description = `${item.label_vi || item.label_en} - Phòng ${booking.roomId}`
    const key = `${category}::${description}`

    if (existingKeys.has(key)) {
      continue
    }

    const amount = Math.max(0, Math.round(Number(item.total) || 0))
    const card_surcharge = payment_method === 'card' ? Math.round(amount * 0.04) : 0

    const newDocRef = doc(collection(db, 'revenue_items'))
    batch.set(newDocRef, {
      booking_id: booking.id,
      group_booking_id: booking.group_booking_id ?? booking.groupBookingId ?? null,
      room_id: booking.roomId,
      guest_name: booking.guestName,
      date,
      category,
      description,
      amount,
      payment_method,
      card_surcharge,
      status,
      created_at: now,
      updated_at: now,
    })
    hasNewItems = true
  }

  if (hasNewItems) {
    await batch.commit()
  }
}
