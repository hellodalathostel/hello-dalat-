import { format } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import type { Booking, Invoice } from '../../types'
import { buildLineItems } from '../../utils/buildLineItems.js'

export interface InvoiceLineItemForm {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface InvoiceDraftInput {
  bookingId: string
  guestName: string
  issueDate: string
  lineItems: InvoiceLineItemForm[]
  subtotal: number
  discount: number
  discountNote: string
  total: number
  paymentMethod: Invoice['paymentMethod']
  cardFeeApplied: boolean
  cardFeeAmount: number
  status: Invoice['status']
  notes: string
}

interface InvoiceFormModalProps {
  booking: Booking
  invoiceNumberPreview: string | null
  error: string | null
  busy: boolean
  onClose: () => void
  onPreview: (draft: InvoiceDraftInput) => Promise<void> | void
  onSave: (draft: InvoiceDraftInput, options: { openAfterSave: boolean }) => Promise<void> | void
}

function toVnd(value: number): string {
  return `${Math.max(0, value || 0).toLocaleString('vi-VN')} đ`
}

function toLineItem(description: string, quantity: number, unitPrice: number): InvoiceLineItemForm {
  return {
    description,
    quantity,
    unitPrice,
    total: quantity * unitPrice,
  }
}

function buildLineItemsFromBooking(booking: Booking): InvoiceLineItemForm[] {
  return buildLineItems(booking).map((item) => ({
    description: item.label_vi || item.label_en,
    quantity: Number(item.qty) || 1,
    unitPrice: Number(item.unit_price) || 0,
    total: Number(item.total) || 0,
  }))
}

function computeTotals(nextDraft: InvoiceDraftInput): InvoiceDraftInput {
  const subtotal = nextDraft.lineItems.reduce((sum, item) => sum + item.total, 0)
  const cardFeeApplied = nextDraft.paymentMethod === 'card'
  const cardFeeAmount = cardFeeApplied ? Math.round(subtotal * 0.04) : 0
  const total = subtotal + cardFeeAmount

  return {
    ...nextDraft,
    subtotal,
    cardFeeApplied,
    cardFeeAmount,
    total,
  }
}

function makeDraftFromBooking(booking: Booking): InvoiceDraftInput {
  const lineItems = buildLineItemsFromBooking(booking)

  return computeTotals({
    bookingId: booking.id,
    guestName: booking.guestName,
    issueDate: format(new Date(), 'yyyy-MM-dd'),
    lineItems,
    subtotal: 0,
    discount: Math.max(0, Number(booking.discount ?? 0) || 0),
    discountNote: booking.discountNote ?? '',
    total: 0,
    paymentMethod: booking.paymentMethod === 'ota' ? 'transfer' : booking.paymentMethod,
    cardFeeApplied: false,
    cardFeeAmount: 0,
    status: 'pending',
    notes: '',
  })
}

export default function InvoiceFormModal({
  booking,
  invoiceNumberPreview,
  error,
  busy,
  onClose,
  onPreview,
  onSave,
}: InvoiceFormModalProps) {
  const [draft, setDraft] = useState<InvoiceDraftInput>(() => makeDraftFromBooking(booking))
  const [action, setAction] = useState<null | 'preview' | 'save' | 'save-download'>(null)

  useEffect(() => {
    setDraft(makeDraftFromBooking(booking))
  }, [booking])

  const invalid = useMemo(
    () => !draft.guestName.trim() || draft.lineItems.length === 0,
    [draft.guestName, draft.lineItems.length],
  )

  function updateLineItem(index: number, key: keyof InvoiceLineItemForm, value: string) {
    setDraft((current) => {
      const lineItems = current.lineItems.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item
        }

        const updated: InvoiceLineItemForm = {
          ...item,
          [key]: key === 'description' ? value : Math.max(0, Number(value) || 0),
        }

        return {
          ...updated,
          total: updated.quantity * updated.unitPrice,
        }
      })

      return computeTotals({
        ...current,
        lineItems,
      })
    })
  }

  async function runAction(nextAction: 'preview' | 'save' | 'save-download') {
    if (invalid || busy) {
      return
    }

    setAction(nextAction)

    try {
      if (nextAction === 'preview') {
        await onPreview(draft)
      } else {
        await onSave(draft, { openAfterSave: nextAction === 'save-download' })
      }
    } catch {
      // Parent already surfaces the error message.
    } finally {
      setAction(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex flex-col gap-1 border-b border-slate-100 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Tao hoa don</h3>
            <p className="text-sm text-slate-500">
              Booking {booking.guestName} - Phong {booking.roomId}
            </p>
          </div>
          <div className="rounded-xl bg-[#faf8f1] px-3 py-2 text-sm text-slate-700">
            So HD du kien: <span className="font-semibold text-slate-900">{invoiceNumberPreview || 'Dang tao...'}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="space-y-1 text-sm text-slate-600 md:col-span-2">
            Ten khach
            <input
              value={draft.guestName}
              onChange={(event) => setDraft((current) => ({ ...current, guestName: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            Ngay hoa don
            <input
              type="date"
              value={draft.issueDate}
              onChange={(event) => setDraft((current) => ({ ...current, issueDate: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-600 md:col-span-2">
            PTTT
            <select
              value={draft.paymentMethod}
              onChange={(event) =>
                setDraft((current) => computeTotals({ ...current, paymentMethod: event.target.value as Invoice['paymentMethod'] }))
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="cash">Tien mat</option>
              <option value="transfer">Chuyen khoan</option>
              <option value="card">The</option>
            </select>
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            Trang thai
            <select
              value={draft.status}
              onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as Invoice['status'] }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="pending">Cho thanh toan</option>
              <option value="paid">Da thanh toan</option>
            </select>
          </label>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-800">Line items</h4>
            <button
              type="button"
              onClick={() => {
                setDraft((current) =>
                  computeTotals({
                    ...current,
                    lineItems: [...current.lineItems, toLineItem('', 1, 0)],
                  }),
                )
              }}
              className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
            >
              + Them dong
            </button>
          </div>

          {draft.lineItems.map((item, index) => (
            <div key={`${index}-${item.description}`} className="grid grid-cols-12 gap-2">
              <input
                value={item.description}
                onChange={(event) => updateLineItem(index, 'description', event.target.value)}
                placeholder="Mo ta"
                className="col-span-5 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              />
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(event) => updateLineItem(index, 'quantity', event.target.value)}
                className="col-span-2 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                value={item.unitPrice}
                onChange={(event) => updateLineItem(index, 'unitPrice', event.target.value)}
                className="col-span-2 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              />
              <input
                value={item.total}
                readOnly
                className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  setDraft((current) =>
                    computeTotals({
                      ...current,
                      lineItems: current.lineItems.filter((_, lineIndex) => lineIndex !== index),
                    }),
                  )
                }}
                className="col-span-1 rounded-lg border border-red-200 text-red-600"
              >
                x
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="space-y-1 text-sm text-slate-600">
            Giam gia
            <input
              type="number"
              min={0}
              value={draft.discount}
              onChange={(event) => {
                const discount = Math.max(0, Number(event.target.value) || 0)
                setDraft((current) => computeTotals({ ...current, discount }))
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            Ghi chu giam gia
            <input
              value={draft.discountNote}
              onChange={(event) => setDraft((current) => ({ ...current, discountNote: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={draft.paymentMethod === 'card'}
              disabled
            />
            Ap dung phi the 4%
          </label>
        </div>

        <div className="mt-4 rounded-xl bg-[#faf8f1] p-3 text-sm text-slate-700">
          <p>Tam tinh: {toVnd(draft.subtotal)}</p>
          <p>Giam gia: -{toVnd(draft.discount)}</p>
          <p>Phi the: +{toVnd(draft.cardFeeAmount)}</p>
          <p className="mt-1 font-semibold text-primary">Tong cong: {toVnd(draft.total)}</p>
        </div>

        <label className="mt-4 block space-y-1 text-sm text-slate-600">
          Ghi chu
          <textarea
            rows={2}
            value={draft.notes}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
          >
            Huy
          </button>
          <button
            type="button"
            onClick={() => {
              void runAction('preview')
            }}
            disabled={busy || invalid}
            className="rounded-xl border border-primary/25 px-4 py-2 text-sm font-semibold text-primary disabled:opacity-60"
          >
            {action === 'preview' ? 'Dang tao...' : 'Mo tai lieu'}
          </button>
          <button
            type="button"
            onClick={() => {
              void runAction('save')
            }}
            disabled={busy || invalid}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
          >
            {action === 'save' ? 'Dang luu...' : 'Luu hoa don'}
          </button>
          <button
            type="button"
            onClick={() => {
              void runAction('save-download')
            }}
            disabled={busy || invalid}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {action === 'save-download' ? 'Dang xu ly...' : 'Luu va mo'}
          </button>
        </div>
      </div>
    </div>
  )
}