import { useEffect, useMemo, useState } from 'react'
import {
  format,
  parseISO,
} from 'date-fns'
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { db } from '../firebase'
import { useInvoices } from '../hooks/useInvoices'
import type { Booking, Invoice } from '../types'
import { generateInvoicePDF } from '../utils/generateInvoice'

interface InvoiceLineItemForm {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

interface InvoiceDraft {
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

function toVnd(value: number): string {
  return `${value.toLocaleString('vi-VN')} đ`
}

function toLineItem(description: string, quantity: number, unitPrice: number): InvoiceLineItemForm {
  return {
    description,
    quantity,
    unitPrice,
    total: quantity * unitPrice,
  }
}

function makeDefaultDraft(): InvoiceDraft {
  const today = format(new Date(), 'yyyy-MM-dd')
  return {
    bookingId: '',
    guestName: '',
    issueDate: today,
    lineItems: [],
    subtotal: 0,
    discount: 0,
    discountNote: '',
    total: 0,
    paymentMethod: 'cash',
    cardFeeApplied: false,
    cardFeeAmount: 0,
    status: 'pending',
    notes: '',
  }
}

function calcNights(checkIn: string, checkOut: string) {
  const inDate = new Date(`${checkIn}T00:00:00`)
  const outDate = new Date(`${checkOut}T00:00:00`)
  const diff = Math.round((outDate.getTime() - inDate.getTime()) / (24 * 60 * 60 * 1000))
  return diff > 0 ? diff : 1
}

function buildLineItemsFromBooking(booking: Booking): InvoiceLineItemForm[] {
  const nights = calcNights(booking.checkIn, booking.checkOut)
  const rows: InvoiceLineItemForm[] = [
    toLineItem('Tien phong', nights, booking.roomRate || 0),
  ]

  if (booking.breakfastIncluded) {
    const people = Math.max(1, booking.adults + booking.children)
    rows.push(toLineItem('Breakfast', people * nights, 50000))
  }

  if (booking.earlyCheckin) {
    rows.push(toLineItem('Early Check-in', 1, 100000))
  }

  if (booking.lateCheckout) {
    rows.push(toLineItem('Late Check-out', 1, 100000))
  }

  return rows
}

export default function InvoicePage() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [draft, setDraft] = useState<InvoiceDraft>(makeDefaultDraft)

  const {
    invoices,
    loading,
    error,
    createInvoice,
    updateInvoice,
    deleteInvoice,
  } = useInvoices(month, statusFilter)

  useEffect(() => {
    async function fetchBookings() {
      setBookingsLoading(true)
      try {
        const bookingQuery = query(
          collection(db, 'bookings'),
          where('status', 'in', ['checkedout', 'checkedin']),
          orderBy('checkOut', 'desc'),
        )
        const snapshot = await getDocs(bookingQuery)
        const rows = snapshot.docs.map((docItem) => ({
          id: docItem.id,
          ...(docItem.data() as Omit<Booking, 'id'>),
        }))
        setBookings(rows)
      } catch (fetchError) {
        console.error(fetchError)
        setBookings([])
      } finally {
        setBookingsLoading(false)
      }
    }

    void fetchBookings()
  }, [])

  const bookingById = useMemo(
    () => new Map(bookings.map((booking) => [booking.id, booking])),
    [bookings],
  )

  function computeTotals(nextDraft: InvoiceDraft): InvoiceDraft {
    const subtotal = nextDraft.lineItems.reduce((sum, item) => sum + item.total, 0)
    const discounted = Math.max(0, subtotal - Math.max(0, nextDraft.discount))
    const cardFeeAmount = nextDraft.cardFeeApplied ? Math.round(discounted * 0.04) : 0
    const total = discounted + cardFeeAmount

    return {
      ...nextDraft,
      subtotal,
      cardFeeAmount,
      total,
    }
  }

  function openCreate() {
    setEditingInvoice(null)
    setDraft(makeDefaultDraft())
    setShowModal(true)
  }

  function openEdit(invoice: Invoice) {
    setEditingInvoice(invoice)
    setDraft({
      bookingId: invoice.bookingId,
      guestName: invoice.guestName,
      issueDate: invoice.issueDate,
      lineItems: invoice.lineItems.map((item) => ({ ...item })),
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      discountNote: invoice.discountNote,
      total: invoice.total,
      paymentMethod: invoice.paymentMethod,
      cardFeeApplied: invoice.cardFeeApplied,
      cardFeeAmount: invoice.cardFeeAmount,
      status: invoice.status,
      notes: invoice.notes,
    })
    setShowModal(true)
  }

  function handleBookingChange(bookingId: string) {
    const booking = bookingById.get(bookingId)

    if (!booking) {
      setDraft((current) => ({ ...current, bookingId: '' }))
      return
    }

    const lineItems = buildLineItemsFromBooking(booking)

    setDraft((current) =>
      computeTotals({
        ...current,
        bookingId,
        guestName: booking.guestName,
        issueDate: format(new Date(), 'yyyy-MM-dd'),
        lineItems,
        paymentMethod: booking.paymentMethod === 'ota' ? 'transfer' : booking.paymentMethod,
      }),
    )
  }

  function updateLineItem(index: number, key: keyof InvoiceLineItemForm, value: string) {
    setDraft((current) => {
      const nextItems = current.lineItems.map((item, itemIndex) => {
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
        lineItems: nextItems,
      })
    })
  }

  async function handleSave(exportAfterSave: boolean) {
    const booking = bookingById.get(draft.bookingId)

    if (!booking || !draft.guestName.trim() || draft.lineItems.length === 0) {
      return
    }

    const payload = {
      bookingId: draft.bookingId,
      guestName: draft.guestName.trim(),
      issueDate: draft.issueDate,
      lineItems: draft.lineItems,
      subtotal: draft.subtotal,
      discount: draft.discount,
      discountNote: draft.discountNote,
      total: draft.total,
      paymentMethod: draft.paymentMethod,
      cardFeeApplied: draft.cardFeeApplied,
      cardFeeAmount: draft.cardFeeAmount,
      status: draft.status,
      notes: draft.notes,
    }

    let invoiceForPdf: Invoice | null = null

    if (editingInvoice) {
      await updateInvoice(editingInvoice.id, payload)
      invoiceForPdf = {
        ...editingInvoice,
        ...payload,
      }
    } else {
      const created = await createInvoice(payload)
      invoiceForPdf = created
    }

    if (exportAfterSave && invoiceForPdf) {
      await generateInvoicePDF(invoiceForPdf, booking, booking.guests ?? [])
    }

    setShowModal(false)
  }

  return (
    <main className="min-h-screen bg-[#f6f3e8] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 rounded-[24px] border border-primary/10 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Hoa don</h1>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            <Plus className="h-4 w-4" /> Tao hoa don
          </button>
        </div>

        <section className="rounded-[24px] border border-primary/10 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-600">
              Thang
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="ml-2 rounded-lg border border-slate-200 px-2 py-1"
              />
            </label>

            <label className="text-sm text-slate-600">
              Trang thai
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | 'paid' | 'pending')}
                className="ml-2 rounded-lg border border-slate-200 px-2 py-1"
              >
                <option value="all">Tat ca</option>
                <option value="paid">Da thanh toan</option>
                <option value="pending">Cho thanh toan</option>
              </select>
            </label>
          </div>

          {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#faf8f1] text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">So HD</th>
                  <th className="px-3 py-2">Khach</th>
                  <th className="px-3 py-2">Phong</th>
                  <th className="px-3 py-2">Ngay</th>
                  <th className="px-3 py-2">Tong</th>
                  <th className="px-3 py-2">TT</th>
                  <th className="px-3 py-2">Thao tac</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-500" colSpan={7}>Dang tai...</td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-slate-500" colSpan={7}>Chua co hoa don</td>
                  </tr>
                ) : (
                  invoices.map((invoice) => {
                    const booking = bookingById.get(invoice.bookingId)

                    return (
                      <tr key={invoice.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium">{invoice.invoiceNumber}</td>
                        <td className="px-3 py-2">{invoice.guestName}</td>
                        <td className="px-3 py-2">{booking?.roomId || '-'}</td>
                        <td className="px-3 py-2">{format(parseISO(invoice.issueDate), 'dd/MM/yyyy')}</td>
                        <td className="px-3 py-2">{toVnd(invoice.total)}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${invoice.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                            {invoice.status === 'paid' ? 'Da TT' : 'Cho TT'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (booking) {
                                  void generateInvoicePDF(invoice, booking, booking.guests ?? [])
                                }
                              }}
                              className="rounded-lg border border-primary/25 px-2 py-1 text-primary hover:bg-primary/10"
                              title="Xuat PDF"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(invoice)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-50"
                              title="Sua"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void deleteInvoice(invoice.id)
                              }}
                              className="rounded-lg border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50"
                              title="Xoa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">
              {editingInvoice ? 'Sua hoa don' : 'Tao hoa don'}
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="space-y-1 text-sm text-slate-600 md:col-span-2">
                Booking
                <select
                  value={draft.bookingId}
                  onChange={(event) => handleBookingChange(event.target.value)}
                  disabled={bookingsLoading}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  <option value="">Chon booking</option>
                  {bookings.map((booking) => (
                    <option key={booking.id} value={booking.id}>
                      {booking.guestName} - Phong {booking.roomId} ({format(parseISO(booking.checkIn), 'dd/MM')} - {format(parseISO(booking.checkOut), 'dd/MM')})
                    </option>
                  ))}
                </select>
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
                Ten khach
                <input
                  value={draft.guestName}
                  onChange={(event) => setDraft((current) => ({ ...current, guestName: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>

              <label className="space-y-1 text-sm text-slate-600">
                PTTT
                <select
                  value={draft.paymentMethod}
                  onChange={(event) => setDraft((current) => ({ ...current, paymentMethod: event.target.value as Invoice['paymentMethod'] }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  <option value="cash">Tien mat</option>
                  <option value="transfer">Chuyen khoan</option>
                  <option value="card">The</option>
                </select>
              </label>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800">Line items</h3>
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
                  checked={draft.cardFeeApplied}
                  onChange={(event) => setDraft((current) => computeTotals({ ...current, cardFeeApplied: event.target.checked }))}
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

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
              >
                Huy
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSave(false)
                }}
                className="rounded-xl border border-primary/25 px-4 py-2 text-sm font-semibold text-primary"
              >
                Luu hoa don
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSave(true)
                }}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
              >
                Xuat PDF ngay
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
