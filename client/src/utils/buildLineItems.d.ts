export interface LineItem {
  type: 'room' | 'breakfast' | 'extra' | 'discount'
  label_en: string
  label_vi: string
  detail: string
  unit_price: number
  qty: number
  total: number
  sort_order: number
}

export interface Totals {
  subtotal: number
  card_fee: number
  total_with_fee: number
  amount_due: number
}

export function buildLineItems(reservation?: unknown): LineItem[]
export function calcTotals(line_items: LineItem[], payment_method: string, deposit_paid?: number): Totals
