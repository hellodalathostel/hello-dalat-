import { useEffect, useMemo, useReducer } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { ExpenseCategoryV2, ExpenseItem, RevenueCategory, RevenueItem } from '../types'

export interface FinanceRange {
  from: string
  to: string
}

interface CreateRevenueInput {
  booking_id?: string | null
  group_booking_id?: string | null
  room_id?: string | null
  guest_name?: string
  date: string
  category: RevenueCategory
  description: string
  amount: number
  payment_method: 'cash' | 'card'
  status: 'paid' | 'unpaid'
}

interface CreateExpenseInput {
  date: string
  category: ExpenseCategoryV2
  description: string
  amount: number
  paid_by?: string
  note?: string
}

interface UseFinanceModuleResult {
  revenueItems: RevenueItem[]
  expenses: ExpenseItem[]
  loading: boolean
  error: string | null
  totalRevenuePaid: number
  totalRevenueAll: number
  totalExpenses: number
  netProfit: number
  outstandingDebt: number
  addRevenueItem: (input: CreateRevenueInput) => Promise<void>
  addExpense: (input: CreateExpenseInput) => Promise<void>
  updateExpense: (id: string, input: Partial<CreateExpenseInput>) => Promise<void>
  deleteExpense: (id: string) => Promise<void>
  markRevenuePaid: (id: string, method: 'cash' | 'card') => Promise<void>
}

function withCardSurcharge(amount: number, paymentMethod: 'cash' | 'card') {
  const base = Math.max(0, Math.round(amount || 0))
  return paymentMethod === 'card' ? Math.round(base * 0.04) : 0
}

type FinanceModuleState = {
  revenueItems: RevenueItem[]
  expenses: ExpenseItem[]
  loading: boolean
  error: string | null
}

type FinanceModuleAction =
  | { type: 'LOADING' }
  | { type: 'REVENUE_SUCCESS'; items: RevenueItem[] }
  | { type: 'EXPENSE_SUCCESS'; items: ExpenseItem[] }
  | { type: 'REVENUE_ERROR'; error: string }
  | { type: 'EXPENSE_ERROR'; error: string }

function financeModuleReducer(state: FinanceModuleState, action: FinanceModuleAction): FinanceModuleState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, loading: true, error: null }
    case 'REVENUE_SUCCESS':
      return { ...state, revenueItems: action.items }
    case 'EXPENSE_SUCCESS':
      return { ...state, expenses: action.items, loading: false }
    case 'REVENUE_ERROR':
      return { ...state, revenueItems: [], error: action.error }
    case 'EXPENSE_ERROR':
      return { ...state, expenses: [], loading: false, error: action.error }
    default:
      return state
  }
}

export function useFinanceModule(range: FinanceRange): UseFinanceModuleResult {
  const [state, dispatch] = useReducer(financeModuleReducer, {
    revenueItems: [],
    expenses: [],
    loading: true,
    error: null,
  })

  useEffect(() => {
    dispatch({ type: 'LOADING' })

    const revenueQuery = query(
      collection(db, 'revenue_items'),
      where('date', '>=', range.from),
      where('date', '<=', range.to),
      orderBy('date', 'desc'),
    )

    const expenseQuery = query(
      collection(db, 'expenses'),
      where('date', '>=', range.from),
      where('date', '<=', range.to),
      orderBy('date', 'desc'),
    )

    const unsubscribeRevenue = onSnapshot(
      revenueQuery,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<RevenueItem, 'id'>),
        }))

        dispatch({ type: 'REVENUE_SUCCESS', items })
      },
      (snapshotError) => {
        console.error(snapshotError)
        dispatch({ type: 'REVENUE_ERROR', error: 'Không thể tải doanh thu.' })
      },
    )

    const unsubscribeExpense = onSnapshot(
      expenseQuery,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ExpenseItem, 'id'>),
        }))

        dispatch({ type: 'EXPENSE_SUCCESS', items })
      },
      (snapshotError) => {
        console.error(snapshotError)
        dispatch({ type: 'EXPENSE_ERROR', error: 'Không thể tải chi phí.' })
      },
    )

    return () => {
      unsubscribeRevenue()
      unsubscribeExpense()
    }
  }, [range.from, range.to])

  const totals = useMemo(() => {
    const totalRevenuePaid = state.revenueItems
      .filter((item) => item.status === 'paid')
      .reduce((sum, item) => sum + Number(item.amount || 0) + Number(item.card_surcharge || 0), 0)

    const totalRevenueAll = state.revenueItems
      .reduce((sum, item) => sum + Number(item.amount || 0) + Number(item.card_surcharge || 0), 0)

    const totalExpenses = state.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0)

    const outstandingDebt = state.revenueItems
      .filter((item) => item.status === 'unpaid')
      .reduce((sum, item) => sum + Number(item.amount || 0) + Number(item.card_surcharge || 0), 0)

    return {
      totalRevenuePaid,
      totalRevenueAll,
      totalExpenses,
      outstandingDebt,
      netProfit: totalRevenuePaid - totalExpenses,
    }
  }, [state.revenueItems, state.expenses])

  async function addRevenueItem(input: CreateRevenueInput) {
    const amount = Math.max(0, Math.round(input.amount || 0))
    const card_surcharge = withCardSurcharge(amount, input.payment_method)
    const now = new Date().toISOString()

    await addDoc(collection(db, 'revenue_items'), {
      booking_id: input.booking_id ?? null,
      group_booking_id: input.group_booking_id ?? null,
      room_id: input.room_id ?? null,
      guest_name: input.guest_name ?? '',
      date: input.date,
      category: input.category,
      description: input.description.trim(),
      amount,
      payment_method: input.payment_method,
      card_surcharge,
      status: input.status,
      created_at: now,
      updated_at: now,
    })
  }

  async function addExpense(input: CreateExpenseInput) {
    const now = new Date().toISOString()

    await addDoc(collection(db, 'expenses'), {
      date: input.date,
      category: input.category,
      description: input.description.trim(),
      amount: Math.max(0, Math.round(input.amount || 0)),
      paid_by: input.paid_by?.trim() || '',
      note: input.note?.trim() || '',
      created_at: now,
      updated_at: now,
    })
  }

  async function updateExpense(id: string, input: Partial<CreateExpenseInput>) {
    await updateDoc(doc(db, 'expenses', id), {
      ...(input.date ? { date: input.date } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      ...(input.amount !== undefined ? { amount: Math.max(0, Math.round(input.amount || 0)) } : {}),
      ...(input.paid_by !== undefined ? { paid_by: input.paid_by.trim() } : {}),
      ...(input.note !== undefined ? { note: input.note.trim() } : {}),
      updated_at: new Date().toISOString(),
    })
  }

  async function deleteExpense(id: string) {
    await deleteDoc(doc(db, 'expenses', id))
  }

  async function markRevenuePaid(id: string, method: 'cash' | 'card') {
    const target = state.revenueItems.find((item) => item.id === id)
    const amount = Number(target?.amount || 0)

    await updateDoc(doc(db, 'revenue_items', id), {
      status: 'paid',
      payment_method: method,
      card_surcharge: withCardSurcharge(amount, method),
      updated_at: new Date().toISOString(),
    })
  }

  return {
    revenueItems: state.revenueItems,
    expenses: state.expenses,
    loading: state.loading,
    error: state.error,
    totalRevenuePaid: totals.totalRevenuePaid,
    totalRevenueAll: totals.totalRevenueAll,
    totalExpenses: totals.totalExpenses,
    netProfit: totals.netProfit,
    outstandingDebt: totals.outstandingDebt,
    addRevenueItem,
    addExpense,
    updateExpense,
    deleteExpense,
    markRevenuePaid,
  }
}
