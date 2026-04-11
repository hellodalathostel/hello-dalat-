import { useEffect, useMemo, useReducer, useState } from 'react'
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { FinanceEntry } from '../types'

interface UseFinanceResult {
  entries: FinanceEntry[]
  loading: boolean
  error: string | null
  totalIncome: number
  totalExpense: number
  netProfit: number
  refetch: () => void
}

type FinanceState = {
  entries: FinanceEntry[]
  loading: boolean
  error: string | null
}

type FinanceAction =
  | { type: 'LOADING' }
  | { type: 'SUCCESS'; entries: FinanceEntry[] }
  | { type: 'ERROR'; error: string }

function financeReducer(state: FinanceState, action: FinanceAction): FinanceState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, loading: true, error: null }
    case 'SUCCESS':
      return { loading: false, error: null, entries: action.entries }
    case 'ERROR':
      return { loading: false, error: action.error, entries: [] }
    default:
      return state
  }
}

export function useFinance(month: string): UseFinanceResult {
  const [state, dispatch] = useReducer(financeReducer, {
    entries: [],
    loading: true,
    error: null,
  })
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    dispatch({ type: 'LOADING' })

    const [yearPart, monthPart] = month.split('-').map(Number)
    const safeYear = Number.isFinite(yearPart) ? yearPart : new Date().getFullYear()
    const safeMonth = Number.isFinite(monthPart) ? monthPart : new Date().getMonth() + 1
    const lastDay = new Date(safeYear, safeMonth, 0).getDate()
    const startDate = `${month}-01`
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`

    const financeQuery = query(
      collection(db, 'financeEntries'),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc'),
    )

    async function fetchData() {
      try {
        const snapshot = await getDocs(financeQuery)

        if (cancelled) {
          return
        }

        const nextEntries = snapshot.docs
          .map((document) => ({
            id: document.id,
            ...(document.data() as Omit<FinanceEntry, 'id'>),
          }))
          .sort((left, right) => right.date.localeCompare(left.date))

        dispatch({ type: 'SUCCESS', entries: nextEntries })
      } catch (fetchError) {
        if (cancelled) {
          return
        }

        console.error(fetchError)
        dispatch({ type: 'ERROR', error: 'Không thể tải dữ liệu tài chính.' })
      }
    }

    void fetchData()

    return () => {
      cancelled = true
    }
  }, [month, reloadTick])

  const { totalIncome, totalExpense } = useMemo(() => {
    let income = 0
    let expense = 0

    state.entries.forEach((entry) => {
      if (entry.type === 'income') {
        income += entry.amount
        return
      }

      expense += entry.amount
    })

    return { totalIncome: income, totalExpense: expense }
  }, [state.entries])

  return {
    entries: state.entries,
    loading: state.loading,
    error: state.error,
    totalIncome,
    totalExpense,
    netProfit: totalIncome - totalExpense,
    refetch: () => setReloadTick((t) => t + 1),
  }
}
