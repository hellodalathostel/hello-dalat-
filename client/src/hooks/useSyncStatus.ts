import { useEffect, useState } from 'react'
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from 'firebase/firestore'
import { db } from '../firebase'

export interface SyncLog {
  id: string
  syncedAt: Date
  roomsSynced: number
  bookingsCreated: number
  bookingsUpdated: number
  errors: string[]
  status: 'success' | 'partial' | 'error'
}

interface UseSyncStatusResult {
  log: SyncLog | null
  loading: boolean
  error: string | null
}

interface SyncLogDoc {
  syncedAt?: Timestamp
  roomsSynced?: number
  bookingsCreated?: number
  bookingsUpdated?: number
  errors?: string[]
  status?: 'success' | 'partial' | 'error'
}

export function useSyncStatus(): UseSyncStatusResult {
  const [log, setLog] = useState<SyncLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const syncLogQuery = query(
      collection(db, 'syncLogs'),
      orderBy('syncedAt', 'desc'),
      limit(1),
    )

    const unsubscribe = onSnapshot(
      syncLogQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setLog(null)
          setError(null)
          setLoading(false)
          return
        }

        const document = snapshot.docs[0]
        const data = document.data() as SyncLogDoc
        const timestamp = data.syncedAt

        if (!timestamp) {
          setLog(null)
          setError(null)
          setLoading(false)
          return
        }

        setLog({
          id: document.id,
          syncedAt: timestamp.toDate(),
          roomsSynced: data.roomsSynced ?? 0,
          bookingsCreated: data.bookingsCreated ?? 0,
          bookingsUpdated: data.bookingsUpdated ?? 0,
          errors: Array.isArray(data.errors) ? data.errors : [],
          status: data.status ?? 'success',
        })
        setError(null)
        setLoading(false)
      },
      () => {
        setError('Không thể tải trạng thái Booking.com sync.')
        setLog(null)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [])

  return {
    log,
    loading,
    error,
  }
}
