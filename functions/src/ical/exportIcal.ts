import { onRequest } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const REGION = 'asia-southeast1'
const ROOM_IDS = new Set(['101', '102', '103', '201', '202', '203', '301', '302'])

if (getApps().length === 0) {
  initializeApp()
}

interface BookingDoc {
  id: string
  guestName: string
  checkIn: string
  checkOut: string
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

function formatUtcTimestamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
}

function dateToCompact(yyyyMmDd: string): string {
  return yyyyMmDd.replace(/-/g, '')
}

function foldLine(line: string): string {
  const limit = 75

  if (line.length <= limit) {
    return line
  }

  let output = ''
  let cursor = 0

  while (cursor < line.length) {
    const chunk = line.slice(cursor, cursor + limit)

    if (cursor === 0) {
      output += chunk
    } else {
      output += `\r\n ${chunk}`
    }

    cursor += limit
  }

  return output
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function buildIcs(roomId: string, bookings: BookingDoc[]): string {
  const dtStamp = formatUtcTimestamp(new Date())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hello Dalat Hostel//PMS//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Hello Dalat - Room ${roomId}`,
    'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
  ]

  for (const booking of bookings) {
    const summaryName = booking.guestName?.trim() || 'Guest'

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${booking.id}@hellodalat`)
    lines.push(`DTSTAMP:${dtStamp}`)
    lines.push(`DTSTART;VALUE=DATE:${dateToCompact(booking.checkIn)}`)
    lines.push(`DTEND;VALUE=DATE:${dateToCompact(booking.checkOut)}`)
    lines.push(`SUMMARY:${escapeText(`BLOCKED - ${summaryName}`)}`)
    lines.push('STATUS:CONFIRMED')
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  return lines.map(foldLine).join('\r\n') + '\r\n'
}

export const exportIcal = onRequest({ region: REGION, cors: false }, async (req, res) => {
  try {
    const match = req.path.match(/\/ical\/(\d+)\.ics/)
    const roomId = match?.[1]

    if (!roomId || !ROOM_IDS.has(roomId)) {
      res.status(404).send('Not found')
      return
    }

    const thresholdDate = new Date()
    thresholdDate.setDate(thresholdDate.getDate() - 30)
    const threshold = `${thresholdDate.getFullYear()}-${pad(thresholdDate.getMonth() + 1)}-${pad(thresholdDate.getDate())}`

    const db = getFirestore()
    const snapshot = await db
      .collection('bookings')
      .where('roomId', '==', roomId)
      .where('status', 'not-in', ['cancelled', 'noshow'])
      .where('checkOut', '>=', threshold)
      .get()

    const bookings: BookingDoc[] = snapshot.docs.map((document) => {
      const data = document.data() as Omit<BookingDoc, 'id'>
      return {
        id: document.id,
        guestName: data.guestName,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
      }
    })

    const ics = buildIcs(roomId, bookings)

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${roomId}.ics"`)
    res.status(200).send(ics)
  } catch (error) {
    logger.error('exportIcal failed', error)
    res.status(500).send('Internal server error')
  }
})
