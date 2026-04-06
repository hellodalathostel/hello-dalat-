import { addMonths, format, parse, parseISO } from 'date-fns'
import { vi } from 'date-fns/locale'
import { deleteDoc, doc } from 'firebase/firestore'
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import FinanceEntryModal from '../components/finance/FinanceEntryModal'
import { db } from '../firebase'
import { useFinance } from '../hooks/useFinance'
import type { FinanceEntry } from '../types'

function formatMoney(value: number) {
  return `${value.toLocaleString('vi-VN')} đ`
}

function parseMonth(month: string) {
  return parse(`${month}-01`, 'yyyy-MM-dd', new Date())
}

export default function FinancePage() {
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { entries, loading, error, totalIncome, totalExpense, netProfit } = useFinance(month)

  const monthLabel = useMemo(
    () => format(parseMonth(month), "'Tháng' M/yyyy", { locale: vi }),
    [month],
  )

  async function handleDeleteEntry(entry: FinanceEntry) {
    const confirmed = window.confirm('Xóa giao dịch này? Không thể hoàn tác.')

    if (!confirmed) {
      return
    }

    setDeletingId(entry.id)

    try {
      await deleteDoc(doc(db, 'financeEntries', entry.id))
    } catch (deleteError) {
      console.error(deleteError)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f3e8] px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[28px] border border-primary/10 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-primary/60">Finance</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">Tài chính</h1>
            </div>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              <Plus className="h-4 w-4" />
              Thêm giao dịch
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setMonth((current) => format(addMonths(parseMonth(current), -1), 'yyyy-MM'))
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-primary/30 hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" />
              Tháng trước
            </button>

            <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">
              {monthLabel}
            </div>

            <button
              type="button"
              onClick={() => {
                setMonth((current) => format(addMonths(parseMonth(current), 1), 'yyyy-MM'))
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-primary/30 hover:text-primary"
            >
              Tháng sau
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-primary/15 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Doanh thu</p>
            <p className="mt-2 text-2xl font-semibold text-primary">{formatMoney(totalIncome)}</p>
          </article>

          <article className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Chi phí</p>
            <p className="mt-2 text-2xl font-semibold text-red-500">{formatMoney(totalExpense)}</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Lợi nhuận</p>
            <p className={`mt-2 text-2xl font-semibold ${netProfit >= 0 ? 'text-primary' : 'text-red-500'}`}>
              {formatMoney(netProfit)}
            </p>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm">
          {error ? (
            <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 md:px-6">
              {error}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#f6f3e8] text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold md:px-6">Ngày</th>
                  <th className="px-4 py-3 font-semibold md:px-6">Loại</th>
                  <th className="px-4 py-3 font-semibold md:px-6">Danh mục</th>
                  <th className="px-4 py-3 font-semibold md:px-6">Ghi chú</th>
                  <th className="px-4 py-3 font-semibold md:px-6">Số tiền</th>
                  <th className="px-4 py-3 font-semibold md:px-6">Xóa</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500 md:px-6">
                      Đang tải dữ liệu tài chính...
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500 md:px-6">
                      Chưa có giao dịch trong tháng này
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 md:px-6">{format(parseISO(entry.date), 'dd/MM/yyyy')}</td>
                      <td className="px-4 py-3 md:px-6">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${entry.type === 'income' ? 'bg-primary/10 text-primary' : 'bg-red-50 text-red-500'}`}>
                          {entry.type === 'income' ? 'Thu' : 'Chi'}
                        </span>
                      </td>
                      <td className="px-4 py-3 md:px-6 text-slate-700">{entry.category}</td>
                      <td className="px-4 py-3 md:px-6 text-slate-600">{entry.note || '-'}</td>
                      <td className={`px-4 py-3 font-semibold md:px-6 ${entry.type === 'income' ? 'text-primary' : 'text-red-500'}`}>
                        {entry.type === 'income' ? '' : '-'}{formatMoney(entry.amount)}
                      </td>
                      <td className="px-4 py-3 md:px-6">
                        <button
                          type="button"
                          onClick={() => {
                            void handleDeleteEntry(entry)
                          }}
                          disabled={deletingId === entry.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Xóa
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <FinanceEntryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => {
          setIsModalOpen(false)
        }}
      />
    </main>
  )
}
