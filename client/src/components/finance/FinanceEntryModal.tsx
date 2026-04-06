import { format } from 'date-fns'
import { addDoc, collection } from 'firebase/firestore'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../../firebase'
import { useAuth } from '../../hooks/useAuth'
import type { ExpenseCategory, FinanceEntry, IncomeCategory } from '../../types'

interface FinanceEntryModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

interface FormState {
  type: FinanceEntry['type']
  date: string
  category: IncomeCategory | ExpenseCategory
  amount: number
  note: string
  bookingId: string
}

const incomeOptions: Array<{ value: IncomeCategory; label: string }> = [
  { value: 'room_revenue', label: 'Doanh thu phòng' },
  { value: 'breakfast', label: 'Ăn sáng' },
  { value: 'scooter_rental', label: 'Thuê xe máy' },
  { value: 'other_income', label: 'Thu nhập khác' },
]

const expenseOptions: Array<{ value: ExpenseCategory; label: string }> = [
  { value: 'supplies', label: 'Vật tư' },
  { value: 'utilities', label: 'Điện nước' },
  { value: 'maintenance', label: 'Bảo trì' },
  { value: 'salary', label: 'Lương' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'food_breakfast', label: 'Thực phẩm ăn sáng' },
  { value: 'other_expense', label: 'Chi phí khác' },
]

function getDefaultState(): FormState {
  return {
    type: 'income',
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'room_revenue',
    amount: 0,
    note: '',
    bookingId: '',
  }
}

export default function FinanceEntryModal({
  isOpen,
  onClose,
  onSaved,
}: FinanceEntryModalProps) {
  const { currentUser } = useAuth()
  const [form, setForm] = useState<FormState>(getDefaultState)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setForm(getDefaultState())
      setError(null)
    }
  }, [isOpen])

  const categoryOptions = useMemo(
    () => (form.type === 'income' ? incomeOptions : expenseOptions),
    [form.type],
  )

  if (!isOpen) {
    return null
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!form.type || !form.date || !form.category || form.amount <= 0) {
      setError('Vui lòng nhập đầy đủ loại, ngày, danh mục và số tiền hợp lệ.')
      return
    }

    setSubmitting(true)

    try {
      await addDoc(collection(db, 'financeEntries'), {
        type: form.type,
        date: form.date,
        category: form.category,
        amount: form.amount,
        note: form.note.trim(),
        bookingId: form.bookingId.trim() ? form.bookingId.trim() : null,
        createdBy: currentUser?.uid ?? 'unknown',
        createdAt: new Date().toISOString(),
      })

      onSaved()
      onClose()
    } catch (submitError) {
      console.error(submitError)
      setError('Không thể lưu giao dịch. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Đóng modal"
      />

      <div className="relative z-10 w-full max-w-[420px] rounded-2xl border border-primary/10 bg-white p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900">Thêm giao dịch</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Loại</p>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setForm((current) => ({
                    ...current,
                    type: 'income',
                    category: 'room_revenue',
                  }))
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  form.type === 'income'
                    ? 'bg-primary text-white'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Thu
              </button>
              <button
                type="button"
                onClick={() => {
                  setForm((current) => ({
                    ...current,
                    type: 'expense',
                    category: 'supplies',
                  }))
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  form.type === 'expense'
                    ? 'bg-primary text-white'
                    : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                Chi
              </button>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Ngày</span>
            <input
              type="date"
              value={form.date}
              onChange={(event) => {
                setForm((current) => ({ ...current, date: event.target.value }))
              }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Danh mục</span>
            <select
              value={form.category}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  category: event.target.value as IncomeCategory | ExpenseCategory,
                }))
              }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Số tiền (VND)</span>
            <input
              type="number"
              min={0}
              value={form.amount}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  amount: Math.max(0, Number(event.target.value) || 0),
                }))
              }}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Ghi chú</span>
            <input
              type="text"
              value={form.note}
              onChange={(event) => {
                setForm((current) => ({ ...current, note: event.target.value }))
              }}
              placeholder="Breakfast for group"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Liên kết booking</span>
            <input
              type="text"
              value={form.bookingId}
              onChange={(event) => {
                setForm((current) => ({
                  ...current,
                  bookingId: event.target.value,
                }))
              }}
              placeholder="bookingId (optional)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
              disabled={submitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? 'Đang lưu...' : 'Lưu giao dịch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
