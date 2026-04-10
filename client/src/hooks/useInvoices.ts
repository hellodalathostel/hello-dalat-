import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { Invoice } from '../types'

type CreateInvoiceInput = Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt'>

interface UseInvoicesResult {
  invoices: Invoice[]
  loading: boolean
  error: string | null
  createInvoice: (data: CreateInvoiceInput) => Promise<Invoice>
  updateInvoice: (id: string, data: Partial<Invoice>) => Promise<void>
  deleteInvoice: (id: string) => Promise<void>
  getNextInvoiceNumber: () => Promise<string>
  refetch: () => Promise<void>
}

function getYear(date = new Date()): number {
  return date.getFullYear()
}

function parseInvoiceCounter(invoiceNumber: string): number {
  const match = invoiceNumber.match(/^HD\d{4}-(\d+)$/)
  if (!match) {
    return 0
  }
  return Number(match[1]) || 0
}

export function useInvoices(month: string, statusFilter: 'all' | 'paid' | 'pending'): UseInvoicesResult {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const constraints = [
        where('issueDate', '>=', `${month}-01`),
        where('issueDate', '<=', `${month}-31`),
        orderBy('issueDate', 'desc'),
      ] as const

      const invoicesQuery = query(collection(db, 'invoices'), ...constraints)
      const snapshot = await getDocs(invoicesQuery)

      const nextInvoices = snapshot.docs
        .map((docItem) => ({
          id: docItem.id,
          ...(docItem.data() as Omit<Invoice, 'id'>),
        }))
        .filter((invoice) => statusFilter === 'all' || invoice.status === statusFilter)

      setInvoices(nextInvoices)
    } catch (fetchError) {
      console.error(fetchError)
      setError('Không thể tải danh sách hóa đơn.')
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }, [month, statusFilter])

  useEffect(() => {
    void fetchInvoices()
  }, [fetchInvoices])

  const getNextInvoiceNumber = useCallback(async () => {
    const year = getYear()
    const startDate = `${year}-01-01`
    const endDate = `${year}-12-31`

    const invoicesQuery = query(
      collection(db, 'invoices'),
      where('issueDate', '>=', startDate),
      where('issueDate', '<=', endDate),
      orderBy('issueDate', 'desc'),
    )

    const snapshot = await getDocs(invoicesQuery)

    let maxCounter = 0
    snapshot.docs.forEach((docItem) => {
      const data = docItem.data() as Partial<Invoice>
      const counter = parseInvoiceCounter(data.invoiceNumber || '')
      if (counter > maxCounter) {
        maxCounter = counter
      }
    })

    const nextCounter = String(maxCounter + 1).padStart(4, '0')
    return `HD${year}-${nextCounter}`
  }, [])

  const createInvoice = useCallback(async (data: CreateInvoiceInput): Promise<Invoice> => {
    const invoiceNumber = await getNextInvoiceNumber()
    const payload = {
      ...data,
      invoiceNumber,
      createdAt: serverTimestamp(),
    }

    const created = await addDoc(collection(db, 'invoices'), payload)
    await fetchInvoices()

    return {
      id: created.id,
      ...data,
      invoiceNumber,
      createdAt: serverTimestamp() as never,
    }
  }, [fetchInvoices, getNextInvoiceNumber])

  const updateInvoiceById = useCallback(async (id: string, data: Partial<Invoice>) => {
    await updateDoc(doc(db, 'invoices', id), data)
    await fetchInvoices()
  }, [fetchInvoices])

  const deleteInvoiceById = useCallback(async (id: string) => {
    await deleteDoc(doc(db, 'invoices', id))
    await fetchInvoices()
  }, [fetchInvoices])

  const value = useMemo(
    () => ({
      invoices,
      loading,
      error,
      createInvoice,
      updateInvoice: updateInvoiceById,
      deleteInvoice: deleteInvoiceById,
      getNextInvoiceNumber,
      refetch: fetchInvoices,
    }),
    [invoices, loading, error, createInvoice, updateInvoiceById, deleteInvoiceById, getNextInvoiceNumber, fetchInvoices],
  )

  return value
}
