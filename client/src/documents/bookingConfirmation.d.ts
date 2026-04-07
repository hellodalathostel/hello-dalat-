import type { Booking } from '../types'

type ReservationDocument = Booking & {
  code?: string
  guest_name?: string
  room_type?: string
  reservation?: {
    room_type?: string
  }
}

export function buildBookingConfirmationHtml(reservation: ReservationDocument): string
export function openBookingConfirmation(reservation: ReservationDocument): void