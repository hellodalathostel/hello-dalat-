import { useState } from 'react'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { Loader2 } from 'lucide-react'
import { app } from '../../firebase'
import { useSyncStatus } from '../../hooks/useSyncStatus'

function formatDateTime(date: Date) {
  const time = date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const day = date.toLocaleDateString('vi-VN')
  return `${time}, ${day}`
}

const statusBadgeClassMap = {
  success: 'bg-green-100 text-green-700 border-green-200',
  partial: 'bg-amber-100 text-amber-700 border-amber-200',
  error: 'bg-red-100 text-red-700 border-red-200',
} as const

const statusLabelMap = {
  success: 'Thành công',
  partial: 'Một phần',
  error: 'Lỗi',
} as const

export default function SyncStatusWidget() {
  const { log, loading, error } = useSyncStatus()
  const [showErrors, setShowErrors] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleManualSync() {
    setSyncing(true)
    setActionError(null)

    try {
      const functions = getFunctions(app, 'asia-southeast1')
      const manualSync = httpsCallable(functions, 'manualSync')
      await manualSync()
    } catch (callError) {
      console.error(callError)
      setActionError('Không thể chạy sync ngay. Vui lòng thử lại.')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <article className="rounded-xl border border-primary/10 bg-[#faf8f1] px-4 py-3 animate-pulse">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="mt-3 h-6 w-28 rounded-full bg-slate-200" />
        <div className="mt-3 h-3 w-full rounded bg-slate-100" />
        <div className="mt-2 h-3 w-4/5 rounded bg-slate-100" />
      </article>
    )
  }

  return (
    <article className="rounded-xl border border-primary/10 bg-[#faf8f1] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-800">Booking.com Sync</h3>

        {log ? (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClassMap[log.status]}`}
          >
            {statusLabelMap[log.status]}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            Chưa có dữ liệu
          </span>
        )}
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      {log ? (
        <div className="mt-3 space-y-1 text-xs text-slate-600">
          <p>Lần cuối: {formatDateTime(log.syncedAt)}</p>
          <p>Phòng đã sync: {log.roomsSynced}/8</p>
          <p>Booking mới: {log.bookingsCreated} | Cập nhật: {log.bookingsUpdated}</p>

          {log.errors.length > 0 ? (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowErrors((current) => !current)}
                className="text-xs font-semibold text-amber-700 hover:text-amber-800"
              >
                {showErrors ? 'Ẩn lỗi' : 'Xem lỗi'} ({log.errors.length})
              </button>

              {showErrors ? (
                <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                  {log.errors.map((errorMessage, index) => (
                    <li key={`${errorMessage}-${index}`}>{errorMessage}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Chưa có dữ liệu sync</p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            void handleManualSync()
          }}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {syncing ? 'Đang sync...' : 'Sync ngay'}
        </button>

        {actionError ? <p className="text-xs text-red-600">{actionError}</p> : null}
      </div>
    </article>
  )
}
