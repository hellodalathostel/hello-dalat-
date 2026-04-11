import fetch from 'node-fetch'
import ICAL from 'ical.js'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'
import { initializeApp, getApps } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const REGION = 'asia-southeast1'
const ROOM_IDS = new Set(['101', '102', '103', '201', '202', '203', '301', '302'])

if (getApps().length === 0) {
  initializeApp()
}

interface BookingIcalMap {
  [roomId: string]: string
}

interface IcalTimeLike {
  toString(): string
}

interface VeventLike {
  getFirstPropertyValue(name: string): unknown
}

interface RoomSyncResult {
  roomId: string
  createdCount: number
  updatedCount: number
  cancelledCount: number
  error?: string
}

interface SyncSummary {
  roomsSynced: number
  bookingsCreated: number
  bookingsUpdated: number
  errors: string[]
  status: 'success' | 'partial' | 'error'
}

function calculateNights(checkIn: string, checkOut: string): number {
  const inDate = new Date(`${checkIn}T00:00:00Z`)
  const outDate = new Date(`${checkOut}T00:00:00Z`)
  const diffMs = outDate.getTime() - inDate.getTime()
  const nights = Math.floor(diffMs / (24 * 60 * 60 * 1000))
  return Number.isFinite(nights) && nights > 0 ? nights : 1
}

function parseConfig(raw: string): BookingIcalMap {
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as BookingIcalMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    logger.error('Invalid BOOKING_ICAL_URLS JSON', error)
    return {}
  }
}

async function fetchIcal(url: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => {
    controller.abort()
  }, 10_000)

  try {
    const response = await fetch(url, { signal: controller.signal })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

function buildSyncSummary(results: RoomSyncResult[]): SyncSummary {
  const errors = results
    .filter((result) => Boolean(result.error))
    .map((result) => `${result.roomId}: ${result.error}`)

  return {
    roomsSynced: results.length,
    bookingsCreated: results.reduce((total, result) => total + result.createdCount, 0),
    bookingsUpdated: results.reduce((total, result) => total + result.updatedCount, 0),
    errors,
    status:
      errors.length === 0
        ? 'success'
        : errors.length < results.length
          ? 'partial'
          : 'error',
  }
}

async function runBookingComSync() {
  const db = getFirestore()
  const rawConfig = process.env.BOOKING_ICAL_URLS || '{}'
  const urlMap = parseConfig(rawConfig)
  const results: RoomSyncResult[] = []

  for (const [roomId, url] of Object.entries(urlMap)) {
    if (!ROOM_IDS.has(roomId) || !url) {
      logger.warn('Skipping invalid room config', { roomId })
      continue
    }

    let createdCount = 0
    let updatedCount = 0
    let cancelledCount = 0

    try {
      const icsText = await fetchIcal(url)
      const jcal = ICAL.parse(icsText)
      const component = new ICAL.Component(jcal)
      const vevents = component.getAllSubcomponents('vevent') as unknown as VeventLike[]
      const activeUids = new Set<string>()
      const now = new Date().toISOString()

      for (const vevent of vevents) {
        const uidRaw = vevent.getFirstPropertyValue('uid')
        const dtStartRaw = vevent.getFirstPropertyValue('dtstart')
        const dtEndRaw = vevent.getFirstPropertyValue('dtend')
        const summaryRaw = vevent.getFirstPropertyValue('summary')

        const uid = typeof uidRaw === 'string' ? uidRaw : ''
        const dtStart = dtStartRaw as IcalTimeLike | null
        const dtEnd = dtEndRaw as IcalTimeLike | null
        const rawSummary = typeof summaryRaw === 'string' ? summaryRaw : ''
        const isGeneric = /closed|not available|blocked/i.test(rawSummary)
        const guestName = isGeneric
          ? 'Booking.com Guest'
          : rawSummary.replace(/^BLOCKED\s*-?\s*/i, '').trim() || 'Booking.com Guest'

        if (!uid || !dtStart || !dtEnd) {
          continue
        }

        const dtStartText = dtStart.toString()
        const dtEndText = dtEnd.toString()
        if (dtStartText.length < 10 || dtEndText.length < 10) {
          logger.warn('Skipping invalid event date', { roomId, uid })
          continue
        }

        const checkIn = dtStartText.slice(0, 10)
        const checkOut = dtEndText.slice(0, 10)

        activeUids.add(uid)

        const existingSnapshot = await db
          .collection('bookings')
          .where('icalEventId', '==', uid)
          .where('roomId', '==', roomId)
          .limit(1)
          .get()

        if (existingSnapshot.empty) {
          const nights = calculateNights(checkIn, checkOut)

          await db.collection('bookings').add({
            roomId,
            source: 'booking.com',
            guestName,
            guestPhone: '',
            guestEmail: '',
            nationality: 'foreign',
            checkIn,
            checkOut,
            earlyCheckin: false,
            lateCheckout: false,
            nights,
            adults: 1,
            children: 0,
            roomRate: 0,
            totalAmount: 0,
            services: [],
            depositPaid: 0,
            paymentStatus: 'paid',
            paymentMethod: 'ota',
            breakfastIncluded: true,
            status: 'confirmed',
            notes: 'Auto-imported from Booking.com iCal',
            icalEventId: uid,
            createdAt: now,
            updatedAt: now,
          })
          createdCount += 1
          logger.info(`Created booking for room ${roomId}: ${uid}`)
          continue
        }

        const existingDoc = existingSnapshot.docs[0]
        const existingData = existingDoc.data() as {
          checkIn?: string
          checkOut?: string
        }

        if (existingData.checkIn !== checkIn || existingData.checkOut !== checkOut) {
          await existingDoc.ref.update({
            checkIn,
            checkOut,
            updatedAt: now,
          })
          updatedCount += 1
          logger.info(`Updated booking ${existingDoc.id} for room ${roomId}`)
        }
      }

      const roomBookingsSnapshot = await db
        .collection('bookings')
        .where('roomId', '==', roomId)
        .where('source', '==', 'booking.com')
        .where('status', '==', 'confirmed')
        .get()

      for (const docSnapshot of roomBookingsSnapshot.docs) {
        const data = docSnapshot.data() as { icalEventId?: string | null }
        const icalEventId = data.icalEventId ?? null

        if (!icalEventId || activeUids.has(icalEventId)) {
          continue
        }

        await docSnapshot.ref.update({
          status: 'cancelled',
          updatedAt: now,
        })
        cancelledCount += 1
        logger.info(`Cancelled removed booking ${docSnapshot.id}`)
      }

      logger.info('Room sync completed', {
        roomId,
        createdCount,
        updatedCount,
        cancelledCount,
      })

      results.push({
        roomId,
        createdCount,
        updatedCount,
        cancelledCount,
      })
    } catch (error) {
      logger.error('Room sync failed', { roomId, error })
      results.push({
        roomId,
        createdCount,
        updatedCount,
        cancelledCount,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const summary = buildSyncSummary(results)

  await db.collection('syncLogs').add({
    syncedAt: FieldValue.serverTimestamp(),
    roomsSynced: summary.roomsSynced,
    bookingsCreated: summary.bookingsCreated,
    bookingsUpdated: summary.bookingsUpdated,
    errors: summary.errors,
    status: summary.status,
  })

  return summary
}

export const syncFromBookingCom = onSchedule(
  {
    region: REGION,
    schedule: 'every 30 minutes',
    timeZone: 'Asia/Ho_Chi_Minh',
  },
  async () => {
    await runBookingComSync()
  },
)

export const manualSync = onCall(
  {
    region: REGION,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required')
    }

    const summary = await runBookingComSync()
    return {
      success: true,
      summary,
    }
  },
)
