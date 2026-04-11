import type { Timestamp } from 'firebase/firestore'

export interface Room {
  id: string
  number: string
  type:
    | 'family'
    | 'single'
    | 'standard_double'
    | 'deluxe_double'
    | 'deluxe_queen'
  typeLabel: string
  bedConfig: string
  capacity: number
  floor: number
  icalUrl: string | null
  amenities: string[]
  isActive: boolean
}

export interface Guest {
  id: string
  fullName: string
  phone: string
  email: string
  nationality: string
  idType: 'cccd' | 'passport' | 'other'
  idNumber: string
  dateOfBirth: string
  gender: 'male' | 'female' | 'other'
  bookingHistory: string[]
}

export interface Group {
  id: string
  groupName: string
  contactPhone: string
  contactEmail: string
  bookingIds: string[]
  source: 'booking.com' | 'direct' | 'walkin'
  status: 'confirmed' | 'cancelled' | 'checkedin' | 'checkedout'
  notes: string
}

export interface GroupBooking {
  id: string
  groupName: string
  createdAt: string
  status: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled'
  note?: string
}

export interface Booking {
  id: string
  groupBookingId?: string | null
  roomId: string
  guestName: string
  guestPhone: string
  guestEmail: string
  nationality: string
  checkIn: string
  checkOut: string
  earlyCheckin: boolean
  lateCheckout: boolean
  nights: number
  adults: number
  children: number
  roomRate: number
  totalAmount: number
  services: ServiceItem[]
  discount?: number
  discountNote?: string
  depositPaid: number
  paymentStatus: 'pending' | 'partial' | 'paid'
  paymentMethod: 'cash' | 'card' | 'transfer' | 'ota'
  source: string
  breakfastIncluded: boolean
  status: 'confirmed' | 'checkedin' | 'checkedout' | 'cancelled' | 'noshow'
  notes: string
  guests?: Guest[]
  icalEventId: string | null
  createdAt: string
  updatedAt: string
}

export interface ServiceItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  total: number
}

export interface FinanceEntry {
  id: string
  date: string
  type: 'income' | 'expense'
  category: FinanceCategory
  amount: number
  note: string
  bookingId: string | null
  createdBy: string
  createdAt: string
}

export type IncomeCategory =
  | 'room_revenue'
  | 'breakfast'
  | 'scooter_rental'
  | 'other_income'

export type ExpenseCategory =
  | 'supplies'
  | 'utilities'
  | 'maintenance'
  | 'salary'
  | 'marketing'
  | 'food_breakfast'
  | 'other_expense'

export type FinanceCategory = IncomeCategory | ExpenseCategory

export interface Invoice {
  id: string
  invoiceNumber: string
  bookingId: string
  guestName: string
  issueDate: string
  lineItems: {
    description: string
    quantity: number
    unitPrice: number
    total: number
  }[]
  subtotal: number
  discount: number
  discountNote: string
  total: number
  paymentMethod: 'cash' | 'card' | 'transfer'
  cardFeeApplied: boolean
  cardFeeAmount: number
  status: 'paid' | 'pending'
  notes: string
  createdAt: Timestamp
}

export type RevenueCategory = 'room' | 'breakfast' | 'scooter' | 'tour' | 'other'

export interface RevenueItem {
  id: string
  bookingId: string | null
  groupBookingId: string | null
  date: string
  category: RevenueCategory
  description: string
  amount: number
  paymentMethod: 'cash' | 'card'
  cardSurcharge: number
  status: 'paid' | 'unpaid'
  roomId?: string | null
  guestName?: string
  createdAt: string
  updatedAt: string
}

export type ExpenseCategoryV2 =
  | 'electricity'
  | 'water'
  | 'salary'
  | 'supplies'
  | 'maintenance'
  | 'marketing'
  | 'other'

export interface ExpenseItem {
  id: string
  date: string
  category: ExpenseCategoryV2
  description: string
  amount: number
  paidBy?: string
  note?: string
  createdAt: string
  updatedAt: string
}
