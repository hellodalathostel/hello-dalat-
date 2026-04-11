import type { Booking, ExpenseItem, GroupBooking, RevenueItem } from '../types'

export interface DbBooking extends Partial<Booking> {
  group_booking_id?: string | null
}

export interface DbGroupBooking {
  group_name?: string
  groupName?: string
  created_at?: string
  createdAt?: string
  status?: GroupBooking['status']
  note?: string
}

export interface DbRevenueItem {
  booking_id?: string | null
  bookingId?: string | null
  group_booking_id?: string | null
  groupBookingId?: string | null
  date?: string
  category?: RevenueItem['category']
  description?: string
  amount?: number
  payment_method?: RevenueItem['paymentMethod']
  paymentMethod?: RevenueItem['paymentMethod']
  card_surcharge?: number
  cardSurcharge?: number
  status?: RevenueItem['status']
  room_id?: string | null
  roomId?: string | null
  guest_name?: string
  guestName?: string
  created_at?: string
  createdAt?: string
  updated_at?: string
  updatedAt?: string
}

export interface DbExpenseItem {
  date?: string
  category?: ExpenseItem['category']
  description?: string
  amount?: number
  paid_by?: string
  paidBy?: string
  note?: string
  created_at?: string
  createdAt?: string
  updated_at?: string
  updatedAt?: string
}

export function mapBookingFromDb(id: string, data: DbBooking): Booking {
  return {
    id,
    ...data,
    groupBookingId: data.groupBookingId ?? data.group_booking_id ?? null,
  } as Booking
}

export function mapGroupBookingFromDb(id: string, data: DbGroupBooking): GroupBooking {
  return {
    id,
    groupName: (data.groupName ?? data.group_name ?? '').trim(),
    createdAt: data.createdAt ?? data.created_at ?? '',
    status: data.status ?? 'confirmed',
    note: data.note ?? '',
  }
}

export function mapRevenueItemFromDb(id: string, data: DbRevenueItem): RevenueItem {
  return {
    id,
    bookingId: data.bookingId ?? data.booking_id ?? null,
    groupBookingId: data.groupBookingId ?? data.group_booking_id ?? null,
    date: data.date ?? '',
    category: data.category ?? 'other',
    description: data.description ?? '',
    amount: Number(data.amount ?? 0),
    paymentMethod: data.paymentMethod ?? data.payment_method ?? 'cash',
    cardSurcharge: Number(data.cardSurcharge ?? data.card_surcharge ?? 0),
    status: data.status ?? 'unpaid',
    roomId: data.roomId ?? data.room_id ?? null,
    guestName: data.guestName ?? data.guest_name ?? '',
    createdAt: data.createdAt ?? data.created_at ?? '',
    updatedAt: data.updatedAt ?? data.updated_at ?? '',
  }
}

export function mapExpenseItemFromDb(id: string, data: DbExpenseItem): ExpenseItem {
  return {
    id,
    date: data.date ?? '',
    category: data.category ?? 'other',
    description: data.description ?? '',
    amount: Number(data.amount ?? 0),
    paidBy: data.paidBy ?? data.paid_by ?? '',
    note: data.note ?? '',
    createdAt: data.createdAt ?? data.created_at ?? '',
    updatedAt: data.updatedAt ?? data.updated_at ?? '',
  }
}

export function mapRevenueItemToDb(item: {
  bookingId?: string | null
  groupBookingId?: string | null
  roomId?: string | null
  guestName?: string
  date: string
  category: RevenueItem['category']
  description: string
  amount: number
  paymentMethod: RevenueItem['paymentMethod']
  cardSurcharge: number
  status: RevenueItem['status']
  createdAt: string
  updatedAt: string
}) {
  return {
    booking_id: item.bookingId ?? null,
    group_booking_id: item.groupBookingId ?? null,
    room_id: item.roomId ?? null,
    guest_name: item.guestName ?? '',
    date: item.date,
    category: item.category,
    description: item.description,
    amount: item.amount,
    payment_method: item.paymentMethod,
    card_surcharge: item.cardSurcharge,
    status: item.status,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  }
}

export function mapExpenseItemToDb(item: {
  date: string
  category: ExpenseItem['category']
  description: string
  amount: number
  paidBy?: string
  note?: string
  createdAt: string
  updatedAt: string
}) {
  return {
    date: item.date,
    category: item.category,
    description: item.description,
    amount: item.amount,
    paid_by: item.paidBy ?? '',
    note: item.note ?? '',
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  }
}
