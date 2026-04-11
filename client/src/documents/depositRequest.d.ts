import type { Booking } from '../types'

type ReservationDocument = Booking & {
  code?: string
  // Legacy fields kept for backward compatibility with older payloads.
  guest_name?: string
  roomType?: string
  room_type?: string
  reservation?: {
    roomType?: string
    room_type?: string
  }
}

export function buildDepositRequestHtml(reservation: ReservationDocument): string
export function openDepositRequest(reservation: ReservationDocument): void