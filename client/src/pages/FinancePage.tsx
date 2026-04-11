import { addMonths, endOfMonth, format, parse, parseISO, startOfMonth } from 'date-fns'
import { vi } from 'date-fns/locale'
import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Plus, Trash2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useFinanceModule } from '../hooks/useFinanceModule'
import { downloadCsv } from '../utils/exportCsv'
import type { ExpenseCategoryV2, ExpenseItem, RevenueCategory, RevenueItem } from '../types'
import { formatMoney } from '../utils/formatMoney'

type FinanceTab = 'revenue' | 'expense' | 'debt' | 'profit'

function parseMonth(month: string) {
  return parse(`${month}-01`, 'yyyy-MM-dd', new Date())
}

const revenueCategories: Array<{ value: RevenueCategory; label: string }> = [
  { value: 'room', label: 'Phòng' },
  { value: 'breakfast', label: 'Ăn sáng' },
  { value: 'scooter', label: 'Xe máy' },
  { value: 'tour', label: 'Tour' },
  { value: 'other', label: 'Khác' },
]

const expenseCategories: Array<{ value: ExpenseCategoryV2; label: string }> = [
  { value: 'electricity', label: 'Điện' },
  { value: 'water', label: 'Nước' },
  { value: 'salary', label: 'Lương' },
  { value: 'supplies', label: 'Vật tư' },
  { value: 'maintenance', label: 'Bảo trì' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Khác' },
]

interface RevenueForm {
  date: string
  category: RevenueCategory
  description: string
  amount: number
  paymentMethod: 'cash' | 'card'
  status: 'paid' | 'unpaid'
}

interface ExpenseForm {
  date: string
  category: ExpenseCategoryV2
  description: string
  amount: number
  paidBy: string
  note: string
}

function getRevenueLabel(category: RevenueCategory) {
  return revenueCategories.find((item) => item.value === category)?.label ?? category
}

function getExpenseLabel(category: ExpenseCategoryV2) {
  return expenseCategories.find((item) => item.value === category)?.label ?? category
}

function revenueTotal(item: RevenueItem) {
  return Number(item.amount || 0) + Number(item.cardSurcharge || 0)
}

export default function FinancePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [month, setMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const initialTab = (searchParams.get('tab') as FinanceTab | null) || 'revenue'
  const [tab, setTab] = useState<FinanceTab>(initialTab)
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)

  const monthStart = format(startOfMonth(parseMonth(month)), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(parseMonth(month)), 'yyyy-MM-dd')
  const [fromDate, setFromDate] = useState(monthStart)
  const [toDate, setToDate] = useState(monthEnd)

  const {
    revenueItems,
    expenses,
    error,
    totalRevenuePaid,
    totalExpenses,
    netProfit,
    outstandingDebt,
    addRevenueItem,
    addExpense,
    updateExpense,
    deleteExpense,
    markRevenuePaid,
    refetch,
  } = useFinanceModule({ from: fromDate, to: toDate })

  const [revenueForm, setRevenueForm] = useState<RevenueForm>({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'other',
    description: '',
    amount: 0,
    paymentMethod: 'cash',
    status: 'paid',
  })

  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: 'supplies',
    description: '',
    amount: 0,
    paidBy: '',
    note: '',
  })

  const monthLabel = useMemo(
    () => format(parseMonth(month), "'Tháng' M/yyyy", { locale: vi }),
    [month],
  )

  useEffect(() => {
    const nextTab = (searchParams.get('tab') as FinanceTab | null) || 'revenue'
    setTab(nextTab)
  }, [searchParams])

  const revenueByCategory = useMemo(() => {
    const grouped: Record<RevenueCategory, number> = {
      room: 0,
      breakfast: 0,
      scooter: 0,
      tour: 0,
      other: 0,
    }

    revenueItems
      .filter((item) => item.status === 'paid')
      .forEach((item) => {
        grouped[item.category] += revenueTotal(item)
      })

    return grouped
  }, [revenueItems])

  const expenseByCategory = useMemo(() => {
    const grouped: Record<ExpenseCategoryV2, number> = {
      electricity: 0,
      water: 0,
      salary: 0,
      supplies: 0,
      maintenance: 0,
      marketing: 0,
      other: 0,
    }

    expenses.forEach((item) => {
      grouped[item.category] += Number(item.amount || 0)
    })

    return grouped
  }, [expenses])

  async function handleAddRevenue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!revenueForm.description.trim() || revenueForm.amount <= 0) {
      return
    }

    await addRevenueItem({
      date: revenueForm.date,
      category: revenueForm.category,
      description: revenueForm.description,
      amount: revenueForm.amount,
      paymentMethod: revenueForm.paymentMethod,
      status: revenueForm.status,
    })

    setRevenueForm((current) => ({
      ...current,
      description: '',
      amount: 0,
    }))
  }

  async function handleAddExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!expenseForm.description.trim() || expenseForm.amount <= 0) {
      return
    }

    await addExpense(expenseForm)
    setExpenseForm((current) => ({
      ...current,
      description: '',
      amount: 0,
      paidBy: '',
      note: '',
    }))
  }

  async function handleDeleteExpense(entry: ExpenseItem) {
    if (!window.confirm('Xóa chi phí này?')) {
      return
    }
    setDeletingExpenseId(entry.id)
    try {
      await deleteExpense(entry.id)
    } finally {
      setDeletingExpenseId(null)
    }
  }

  function exportRevenueCsv() {
    downloadCsv(
      `doanh-thu-${fromDate}-${toDate}.csv`,
      ['Ngày', 'Booking ID', 'Phòng', 'Khách', 'Danh mục', 'Mô tả', 'Số tiền', 'Phương thức', 'Phụ thu thẻ', 'Trạng thái'],
      revenueItems.map((item) => [
        item.date,
        item.bookingId || '',
        item.roomId || '',
        item.guestName || '',
        getRevenueLabel(item.category),
        item.description,
        item.amount,
        item.paymentMethod,
        item.cardSurcharge,
        item.status,
      ]),
    )
  }

  function exportExpenseCsv() {
    downloadCsv(
      `chi-phi-${fromDate}-${toDate}.csv`,
      ['Ngày', 'Danh mục', 'Mô tả', 'Số tiền', 'Ghi chú'],
      expenses.map((item) => [item.date, getExpenseLabel(item.category), item.description, item.amount, item.note || '']),
    )
  }

  function exportDebtCsv() {
    const unpaid = revenueItems.filter((item) => item.status === 'unpaid')
    downloadCsv(
      `cong-no-${fromDate}-${toDate}.csv`,
      ['Ngày', 'Khách', 'Phòng', 'Danh mục', 'Số tiền', 'Booking ID'],
      unpaid.map((item) => [
        item.date,
        item.guestName || '',
        item.roomId || '',
        getRevenueLabel(item.category),
        revenueTotal(item),
        item.bookingId || '',
      ]),
    )
  }

  function exportProfitCsv() {
    const revenueRows = Object.entries(revenueByCategory).map(([category, amount]) => [
      `Revenue - ${getRevenueLabel(category as RevenueCategory)}`,
      amount,
      totalRevenuePaid > 0 ? `${((amount / totalRevenuePaid) * 100).toFixed(2)}%` : '0%',
    ])

    const expenseRows = Object.entries(expenseByCategory).map(([category, amount]) => [
      `Expense - ${getExpenseLabel(category as ExpenseCategoryV2)}`,
      amount,
      totalExpenses > 0 ? `${((amount / totalExpenses) * 100).toFixed(2)}%` : '0%',
    ])

    downloadCsv(
      `bao-cao-loi-nhuan-${fromDate}-${toDate}.csv`,
      ['Mục', 'Giá trị', 'Tỷ trọng'],
      [
        ['Total Revenue (Paid)', totalRevenuePaid, ''],
        ['Total Expenses', totalExpenses, ''],
        ['Outstanding Debt', outstandingDebt, ''],
        ['Net Profit', netProfit, ''],
        ...revenueRows,
        ...expenseRows,
      ],
    )
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
              onClick={refetch}
              className="rounded-xl border border-primary/15 bg-white px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/5"
            >
              Làm mới
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

            <div className="ml-auto flex items-center gap-2">
              <label className="text-xs text-slate-500">Từ</label>
              <input
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
              <label className="text-xs text-slate-500">Đến</label>
              <input
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {([
              ['revenue', 'Doanh thu'],
              ['expense', 'Chi phí'],
              ['debt', 'Công nợ'],
              ['profit', 'Báo cáo lợi nhuận'],
            ] as Array<[FinanceTab, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTab(value)
                  setSearchParams({ tab: value })
                }}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${
                  tab === value
                    ? 'bg-primary text-white'
                    : 'border border-slate-200 text-slate-600 hover:border-primary/30 hover:text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-primary/15 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Doanh thu (đã thu)</p>
            <p className="mt-2 text-2xl font-semibold text-primary">{formatMoney(totalRevenuePaid)}</p>
          </article>

          <article className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Chi phí</p>
            <p className="mt-2 text-2xl font-semibold text-red-500">{formatMoney(totalExpenses)}</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Lợi nhuận / Công nợ</p>
            <p className={`mt-2 text-2xl font-semibold ${netProfit >= 0 ? 'text-primary' : 'text-red-500'}`}>
              {formatMoney(netProfit)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Công nợ: {formatMoney(outstandingDebt)}</p>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm">
          {error ? (
            <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600 md:px-6">
              {error}
            </div>
          ) : null}

          {tab === 'revenue' ? (
            <div className="space-y-4 p-4 md:p-6">
              <form onSubmit={handleAddRevenue} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-[#fffdf8] p-3 md:grid-cols-6">
                <input type="date" value={revenueForm.date} onChange={(event) => setRevenueForm((c) => ({ ...c, date: event.target.value }))} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
                <select value={revenueForm.category} onChange={(event) => setRevenueForm((c) => ({ ...c, category: event.target.value as RevenueCategory }))} className="rounded-lg border border-slate-200 px-2 py-2 text-sm">
                  {revenueCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <input value={revenueForm.description} onChange={(event) => setRevenueForm((c) => ({ ...c, description: event.target.value }))} placeholder="Mô tả" className="rounded-lg border border-slate-200 px-2 py-2 text-sm md:col-span-2" />
                <input type="number" min={0} value={revenueForm.amount} onChange={(event) => setRevenueForm((c) => ({ ...c, amount: Math.max(0, Number(event.target.value) || 0) }))} placeholder="Số tiền" className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
                <div className="flex gap-2">
                  <select value={revenueForm.paymentMethod} onChange={(event) => setRevenueForm((c) => ({ ...c, paymentMethod: event.target.value as 'cash' | 'card' }))} className="rounded-lg border border-slate-200 px-2 py-2 text-sm">
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                  </select>
                  <select value={revenueForm.status} onChange={(event) => setRevenueForm((c) => ({ ...c, status: event.target.value as 'paid' | 'unpaid' }))} className="rounded-lg border border-slate-200 px-2 py-2 text-sm">
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                  <button className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" /> Thêm</button>
                </div>
              </form>

              <div className="flex justify-end">
                <button type="button" onClick={exportRevenueCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-primary/30 hover:text-primary"><Download className="h-4 w-4" /> Export CSV</button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f6f3e8] text-slate-700">
                    <tr>
                      <th className="px-3 py-2">Ngày</th>
                      <th className="px-3 py-2">Booking</th>
                      <th className="px-3 py-2">Danh mục</th>
                      <th className="px-3 py-2">Mô tả</th>
                      <th className="px-3 py-2">Số tiền</th>
                      <th className="px-3 py-2">TT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueItems.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">{format(parseISO(item.date), 'dd/MM/yyyy')}</td>
                        <td className="px-3 py-2 text-slate-600">{item.bookingId || '-'}</td>
                        <td className="px-3 py-2">{getRevenueLabel(item.category)}</td>
                        <td className="px-3 py-2 text-slate-600">{item.description}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{formatMoney(revenueTotal(item))}</td>
                        <td className="px-3 py-2">
                          {item.status === 'paid' ? (
                            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Paid</span>
                          ) : (
                            <div className="flex gap-2">
                              <button type="button" onClick={() => void markRevenuePaid(item.id, 'cash')} className="rounded border border-slate-200 px-2 py-1 text-xs">Cash</button>
                              <button type="button" onClick={() => void markRevenuePaid(item.id, 'card')} className="rounded border border-slate-200 px-2 py-1 text-xs">Card</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          ) : null}

          {tab === 'expense' ? (
            <div className="space-y-4 p-4 md:p-6">
              <form onSubmit={handleAddExpense} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-[#fffdf8] p-3 md:grid-cols-6">
                <input type="date" value={expenseForm.date} onChange={(event) => setExpenseForm((c) => ({ ...c, date: event.target.value }))} className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
                <select value={expenseForm.category} onChange={(event) => setExpenseForm((c) => ({ ...c, category: event.target.value as ExpenseCategoryV2 }))} className="rounded-lg border border-slate-200 px-2 py-2 text-sm">
                  {expenseCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <input value={expenseForm.description} onChange={(event) => setExpenseForm((c) => ({ ...c, description: event.target.value }))} placeholder="Mô tả" className="rounded-lg border border-slate-200 px-2 py-2 text-sm md:col-span-2" />
                <input type="number" min={0} value={expenseForm.amount} onChange={(event) => setExpenseForm((c) => ({ ...c, amount: Math.max(0, Number(event.target.value) || 0) }))} placeholder="Số tiền" className="rounded-lg border border-slate-200 px-2 py-2 text-sm" />
                <div className="flex gap-2">
                  <input value={expenseForm.paidBy} onChange={(event) => setExpenseForm((c) => ({ ...c, paidBy: event.target.value }))} placeholder="Người chi" className="w-full rounded-lg border border-slate-200 px-2 py-2 text-sm" />
                  <button className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" /> Thêm</button>
                </div>
              </form>

              <div className="flex justify-end">
                <button type="button" onClick={exportExpenseCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-primary/30 hover:text-primary"><Download className="h-4 w-4" /> Export CSV</button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f6f3e8] text-slate-700">
                    <tr>
                      <th className="px-3 py-2">Ngày</th>
                      <th className="px-3 py-2">Danh mục</th>
                      <th className="px-3 py-2">Mô tả</th>
                      <th className="px-3 py-2">Số tiền</th>
                      <th className="px-3 py-2">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">{format(parseISO(item.date), 'dd/MM/yyyy')}</td>
                        <td className="px-3 py-2">{getExpenseLabel(item.category)}</td>
                        <td className="px-3 py-2 text-slate-600">{item.description}</td>
                        <td className="px-3 py-2 font-semibold text-red-500">-{formatMoney(item.amount)}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const nextDesc = window.prompt('Mô tả mới', item.description)
                                if (nextDesc === null) return
                                const nextAmountRaw = window.prompt('Số tiền mới', String(item.amount))
                                if (nextAmountRaw === null) return
                                const nextAmount = Math.max(0, Number(nextAmountRaw) || 0)
                                setEditingExpenseId(item.id)
                                void updateExpense(item.id, { description: nextDesc, amount: nextAmount }).finally(() => setEditingExpenseId(null))
                              }}
                              disabled={editingExpenseId === item.id}
                              className="rounded border border-slate-200 px-2 py-1 text-xs"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => { void handleDeleteExpense(item) }}
                              disabled={deletingExpenseId === item.id}
                              className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">Tổng chi phí theo danh mục</div>
                <div className="p-3">
                  {Object.entries(expenseByCategory).map(([key, amount]) => (
                    <div key={key} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-b-0">
                      <span>{getExpenseLabel(key as ExpenseCategoryV2)}</span>
                      <span className="font-semibold text-red-600">{formatMoney(amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'debt' ? (
            <div className="space-y-4 p-4 md:p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-600">Tổng công nợ: <span className="font-semibold text-red-600">{formatMoney(outstandingDebt)}</span></p>
                <button type="button" onClick={exportDebtCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-primary/30 hover:text-primary"><Download className="h-4 w-4" /> Export CSV</button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#f6f3e8] text-slate-700">
                    <tr>
                      <th className="px-3 py-2">Ngày</th>
                      <th className="px-3 py-2">Khách</th>
                      <th className="px-3 py-2">Phòng</th>
                      <th className="px-3 py-2">Danh mục</th>
                      <th className="px-3 py-2">Số tiền</th>
                      <th className="px-3 py-2">Booking ID</th>
                      <th className="px-3 py-2">Mark Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueItems.filter((item) => item.status === 'unpaid').map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">{format(parseISO(item.date), 'dd/MM/yyyy')}</td>
                        <td className="px-3 py-2">{item.guestName || '-'}</td>
                        <td className="px-3 py-2">{item.roomId || '-'}</td>
                        <td className="px-3 py-2">{getRevenueLabel(item.category)}</td>
                        <td className="px-3 py-2 font-semibold text-red-600">{formatMoney(revenueTotal(item))}</td>
                        <td className="px-3 py-2 text-slate-600">{item.bookingId || '-'}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => void markRevenuePaid(item.id, 'cash')} className="rounded border border-slate-200 px-2 py-1 text-xs">Cash</button>
                            <button type="button" onClick={() => void markRevenuePaid(item.id, 'card')} className="rounded border border-slate-200 px-2 py-1 text-xs">Card</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {tab === 'profit' ? (
            <div className="space-y-4 p-4 md:p-6">
              <div className="flex justify-end">
                <button type="button" onClick={exportProfitCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-primary/30 hover:text-primary"><Download className="h-4 w-4" /> Export CSV</button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <article className="rounded-xl border border-primary/10 bg-[#faf8f1] p-3"><p className="text-xs text-slate-500">Total Revenue</p><p className="mt-1 text-lg font-semibold text-primary">{formatMoney(totalRevenuePaid)}</p></article>
                <article className="rounded-xl border border-red-100 bg-red-50/40 p-3"><p className="text-xs text-slate-500">Total Expenses</p><p className="mt-1 text-lg font-semibold text-red-500">{formatMoney(totalExpenses)}</p></article>
                <article className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"><p className="text-xs text-slate-500">Net Profit</p><p className={`mt-1 text-lg font-semibold ${netProfit >= 0 ? 'text-primary' : 'text-red-500'}`}>{formatMoney(netProfit)}</p></article>
                <article className="rounded-xl border border-amber-200 bg-amber-50/60 p-3"><p className="text-xs text-slate-500">Outstanding Debt</p><p className="mt-1 text-lg font-semibold text-amber-700">{formatMoney(outstandingDebt)}</p></article>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">Revenue Breakdown</div>
                  <div className="p-3">
                    {Object.entries(revenueByCategory).map(([key, amount]) => (
                      <div key={key} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-b-0">
                        <span>{getRevenueLabel(key as RevenueCategory)}</span>
                        <span className="font-semibold">{formatMoney(amount)} ({totalRevenuePaid > 0 ? ((amount / totalRevenuePaid) * 100).toFixed(1) : '0'}%)</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">Expense Breakdown</div>
                  <div className="p-3">
                    {Object.entries(expenseByCategory).map(([key, amount]) => (
                      <div key={key} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-b-0">
                        <span>{getExpenseLabel(key as ExpenseCategoryV2)}</span>
                        <span className="font-semibold">{formatMoney(amount)} ({totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : '0'}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}
