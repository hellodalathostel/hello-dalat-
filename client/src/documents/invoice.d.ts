import type { Booking, Invoice } from '../types'

type ReservationDocument = Booking & {
  code?: string
  guest_name?: string
  room_type?: string
  reservation?: {
    room_type?: string
  }
}

type InvoiceDocument = Invoice & {
  number?: string
  issue_date?: string
  guest_name?: string
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