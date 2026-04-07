import { format } from 'date-fns'
import { X } from 'lucide-react'
import { deleteDoc, doc } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../../firebase'
import { useInvoices } from '../../hooks/useInvoices'
import type { Booking, Invoice } from '../../types'
import { openBookingConfirmation } from '../../documents/bookingConfirmation'
import { openDepositRequest } from '../../documents/depositRequest'
import { openInvoice } from '../../documents/invoice'
import BookingForm from './BookingForm'
import type { InvoiceDraftInput } from '../documents/InvoiceFormModal'
import InvoiceFormModal from '../documents/InvoiceFormModal'

interface BookingDrawerProps {
  booking?: Booking
  defaultRoomId?: string
  defaultDate?: string
  onClose: () => void
  onSaved: () => void
}

function toInvoicePayload(draft: InvoiceDraftInput): Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt'> {
  return {
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
}

export default function BookingDrawer({
  booking,
  defaultRoomId,
  defaultDate,
  onClose,
  onSaved,
}: BookingDrawerProps) {
  const [deleting, setDeleting] = useState(false)
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [documentBusy, setDocumentBusy] = useState<null | string>(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState<string | null>(null)
  const invoiceMonth = useMemo(() => format(new Date(), 'yyyy-MM'), [])
  const { createInvoice, getNextInvoiceNumber } = useInvoices(invoiceMonth, 'all')

  useEffect(() => {
    if (!showInvoiceModal) {
      return
    }

    let cancelled = false

    void getNextInvoiceNumber()
      .then((invoiceNumber) => {
        if (!cancelled) {
          setNextInvoiceNumber(invoiceNumber)
        }
      })
      .catch((error) => {
        console.error(error)
      })

    return () => {
      cancelled = true
    }
  }, [getNextInvoiceNumber, showInvoiceModal])

  useEffect(() => {
    setDocumentError(null)
  }, [booking?.id])

  async function handleDeleteBooking() {
    if (!booking) {
      return
    }

    const isConfirmed = window.confirm(
      `Xóa booking của ${booking.guestName}? Không thể hoàn tác.`,
    )

    if (!isConfirmed) {
      return
    }

    setDeleting(true)

    try {
      await deleteDoc(doc(db, 'bookings', booking.id))
      onSaved()
      onClose()
    } catch (error) {
      console.error(error)
    } finally {
      setDeleting(false)
    }
  }

  function openDepositDocument() {
    if (!booking) {
      return
    }

    setDocumentError(null)

    try {
      const bookingForDocument: Booking = {
        ...booking,
        depositPaid: booking.depositPaid > 0 ? booking.depositPaid : booking.roomRate,
      }
      openDepositRequest(bookingForDocument)
    } catch (error) {
      console.error(error)
      setDocumentError('Khong the mo yeu cau dat coc.')
    }
  }

  function openConfirmationDocument() {
    if (!booking) {
      return
    }

    setDocumentError(null)

    try {
      openBookingConfirmation(booking)
    } catch (error) {
      console.error(error)
      setDocumentError('Khong the mo xac nhan dat phong.')
    }
  }

  function buildPreviewInvoice(draft: InvoiceDraftInput): Invoice {
    const year = new Date(draft.issueDate || new Date().toISOString()).getFullYear()

    return {
      id: 'preview',
      invoiceNumber: nextInvoiceNumber || `HD${year}-PREVIEW`,
      createdAt: null as never,
      ...toInvoicePayload(draft),
    }
  }

  function openInvoicePreview(draft: InvoiceDraftInput) {
    if (!booking) {
      return
    }

    setDocumentError(null)

    try {
      const invoice = buildPreviewInvoice(draft)
      openInvoice(booking, invoice)
    } catch (error) {
      console.error(error)
      setDocumentError('Khong the mo hoa don.')
    }
  }

  async function saveInvoice(draft: InvoiceDraftInput, options: { openAfterSave: boolean }) {
    if (!booking) {
      return
    }

    setDocumentBusy(options.openAfterSave ? 'invoice-save-open' : 'invoice-save')
    setDocumentError(null)

    try {
      const created = await createInvoice(toInvoicePayload(draft))

      if (options.openAfterSave) {
        openInvoice(booking, created)
      }

      setShowInvoiceModal(false)
    } catch (error) {
      console.error(error)
      setDocumentError('Khong the luu hoa don.')
      throw error
    } finally {
      setDocumentBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Đóng drawer"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl md:w-[480px]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 md:px-6 md:py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {booking ? 'Chỉnh sửa booking' : 'Tạo booking mới'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {booking ? (
          <section className="border-b border-slate-200 bg-[#faf8f1] px-4 py-4 md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Tai lieu booking</h3>
                <p className="text-xs text-slate-500">Mo tai lieu trong popup va in luon tu trinh duyet.</p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openDepositDocument}
                disabled={Boolean(documentBusy)}
                className="rounded-xl border border-primary px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                📋 Deposit Request
              </button>
              <button
                type="button"
                onClick={openConfirmationDocument}
                disabled={Boolean(documentBusy)}
                className="rounded-xl border border-primary px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                ✅ Booking Confirmation
              </button>
              <button
                type="button"
                onClick={() => setShowInvoiceModal(true)}
                disabled={Boolean(documentBusy)}
                className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                🧾 Invoice
              </button>
            </div>

            {documentError ? (
              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {documentError}
              </p>
            ) : null}
          </section>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fffdf8]">
          <BookingForm
            booking={booking}
            defaultRoomId={defaultRoomId}
            defaultDate={defaultDate}
            onClose={onClose}
            onSaved={onSaved}
          />
        </div>

        {booking ? (
          <div className="flex items-center border-t border-slate-200 bg-white px-4 py-3 md:px-6">
            <button
              type="button"
              onClick={() => {
                void handleDeleteBooking()
              }}
              disabled={deleting}
              className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {deleting ? 'Đang xóa...' : 'Xóa booking'}
            </button>
          </div>
        ) : null}
      </aside>

      {showInvoiceModal && booking ? (
        <InvoiceFormModal
          booking={booking}
          invoiceNumberPreview={nextInvoiceNumber}
          error={documentError}
          busy={Boolean(documentBusy)}
          onClose={() => setShowInvoiceModal(false)}
          onPreview={openInvoicePreview}
          onSave={saveInvoice}
        />
      ) : null}
    </div>
  )
}