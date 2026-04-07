import type { Booking, GroupBooking } from '../types'

export function buildGroupBillHtml(
  group: GroupBooking,
  rooms: Booking[],
  paymentMethod?: 'cash' | 'card',
): string

export function openGroupBill(
  group: GroupBooking,
  rooms: Booking[],
  paymentMethod?: 'cash' | 'card',
): void
