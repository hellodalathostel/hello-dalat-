import type { Booking, Invoice } from '../types'

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

type InvoiceDocument = Invoice & {
  number?: string
  issueDate?: string
  issue_date?: string
  guestName?: string
  guest_name?: string
  lineItems?: Array<{
    description?: string
    name?: string
    quantity?: number
    unitPrice?: number
    unit_price?: number
    total?: number
  }>
  line_items?: Array<{
    description?: string
    name?: string
    quantity?: number
    unitPrice?: number
    unit_price?: number
    total?: number
  }>
}

export function buildInvoiceHtml(reservation: ReservationDocument, invoice: InvoiceDocument): string
export function openInvoice(reservation: ReservationDocument, invoice: InvoiceDocument): void