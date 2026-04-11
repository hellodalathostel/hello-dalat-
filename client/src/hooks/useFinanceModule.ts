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
import {
  mapExpenseItemFromDb,
  mapExpenseItemToDb,
  mapRevenueItemFromDb,
  mapRevenueItemToDb,
  type DbExpenseItem,
  type DbRevenueItem,
} from '../utils/firestoreMappers'

export interface FinanceRange {
  from: string
  to: string
}

interface CreateRevenueInput {
  bookingId?: string | null
  groupBookingId?: string | null
  roomId?: string | null
  guestName?: string
  date: string
  category: RevenueCategory
  description: string
  amount: number
  paymentMethod: 'cash' | 'card'
  status: 'paid' | 'unpaid'
}

interface CreateExpenseInput {
  date: string
  category: ExpenseCategoryV2
  description: string
  amount: number
  paidBy?: string
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
  revenueLoaded: boolean
  expenseLoaded: boolean
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
      return {
        ...state,
        loading: true,
        revenueLoaded: false,
        expenseLoaded: false,
        error: null,
      }
    case 'REVENUE_SUCCESS':
      return {
        ...state,
        revenueItems: action.items,
        revenueLoaded: true,
        loading: !state.expenseLoaded,
      }
    case 'EXPENSE_SUCCESS':
      return {
        ...state,
        expenses: action.items,
        expenseLoaded: true,
        loading: !state.revenueLoaded,
      }
    case 'REVENUE_ERROR':
      return {
        ...state,
        revenueItems: [],
        revenueLoaded: true,
        loading: !state.expenseLoaded,
        error: action.error,
      }
    case 'EXPENSE_ERROR':
      return {
        ...state,
        expenses: [],
        expenseLoaded: true,
        loading: !state.revenueLoaded,
        error: action.error,
      }
    default:
      return state
  }
}

export function useFinanceModule(range: FinanceRange): UseFinanceModuleResult {
  const [state, dispatch] = useReducer(financeModuleReducer, {
    revenueItems: [],
    expenses: [],
    revenueLoaded: false,
    expenseLoaded: false,
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
          ...mapRevenueItemFromDb(d.id, d.data() as DbRevenueItem),
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
          ...mapExpenseItemFromDb(d.id, d.data() as DbExpenseItem),
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
      .reduce((sum, item) => sum + Number(item.amount || 0) + Number(item.cardSurcharge || 0), 0)

    const totalRevenueAll = state.revenueItems
      .reduce((sum, item) => sum + Number(item.amount || 0) + Number(item.cardSurcharge || 0), 0)

    const totalExpenses = state.expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0)

    const outstandingDebt = state.revenueItems
      .filter((item) => item.status === 'unpaid')
      .reduce((sum, item) => sum + Number(item.amount || 0) + Number(item.cardSurcharge || 0), 0)

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
    const cardSurcharge = withCardSurcharge(amount, input.paymentMethod)
    const now = new Date().toISOString()

    await addDoc(collection(db, 'revenue_items'), mapRevenueItemToDb({
      bookingId: input.bookingId ?? null,
      groupBookingId: input.groupBookingId ?? null,
      roomId: input.roomId ?? null,
      guestName: input.guestName ?? '',
      date: input.date,
      category: input.category,
      description: input.description.trim(),
      amount,
      paymentMethod: input.paymentMethod,
      cardSurcharge,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    }))
  }

  async function addExpense(input: CreateExpenseInput) {
    const now = new Date().toISOString()

    await addDoc(collection(db, 'expenses'), mapExpenseItemToDb({
      date: input.date,
      category: input.category,
      description: input.description.trim(),
      amount: Math.max(0, Math.round(input.amount || 0)),
      paidBy: input.paidBy?.trim() || '',
      note: input.note?.trim() || '',
      createdAt: now,
      updatedAt: now,
    }))
  }

  async function updateExpense(id: string, input: Partial<CreateExpenseInput>) {
    await updateDoc(doc(db, 'expenses', id), {
      ...(input.date ? { date: input.date } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      ...(input.amount !== undefined ? { amount: Math.max(0, Math.round(input.amount || 0)) } : {}),
      ...(input.paidBy !== undefined ? { paid_by: input.paidBy.trim() } : {}),
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
