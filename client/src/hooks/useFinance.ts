import { useEffect, useMemo, useState } from 'react'
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

export function useFinance(month: string): UseFinanceResult {
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

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

        setEntries(nextEntries)
        setLoading(false)
      },
      (snapshotError) => {
        console.error(snapshotError)
        setError('Không thể tải dữ liệu tài chính.')
        setEntries([])
        setLoading(false)
      },
    )

    return unsubscribe
  }, [month])

  const { totalIncome, totalExpense } = useMemo(() => {
    let income = 0
    let expense = 0

    entries.forEach((entry) => {
      if (entry.type === 'income') {
        income += entry.amount
        return
      }

      expense += entry.amount
    })

    return { totalIncome: income, totalExpense: expense }
  }, [entries])

  return {
    entries,
    loading,
    error,
    totalIncome,
    totalExpense,
    netProfit: totalIncome - totalExpense,
  }
}
