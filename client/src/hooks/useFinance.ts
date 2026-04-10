import { useEffect, useMemo, useReducer } from 'react'
import {
  collection,
  onSnapshot,
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

  useEffect(() => {
    dispatch({ type: 'LOADING' })

    const financeQuery = query(
      collection(db, 'financeEntries'),
      where('date', '>=', `${month}-01`),
      where('date', '<=', `${month}-31`),
      orderBy('date', 'desc'),
    )

    const unsubscribe = onSnapshot(
      financeQuery,
      (snapshot) => {
        const nextEntries = snapshot.docs
          .map((document) => ({
            id: document.id,
            ...(document.data() as Omit<FinanceEntry, 'id'>),
          }))
          .sort((left, right) => right.date.localeCompare(left.date))

        dispatch({ type: 'SUCCESS', entries: nextEntries })
      },
      (snapshotError) => {
        console.error(snapshotError)
        dispatch({ type: 'ERROR', error: 'Không thể tải dữ liệu tài chính.' })
      },
    )

    return unsubscribe
  }, [month])

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
  }
}
