import { useEffect, useState } from 'react'
import { AlertCircle, DownloadCloud, LoaderCircle } from 'lucide-react'
import { api } from '@/services/api'
import { Button } from '@/components/ui/button'

type Status = { status: string; progress: number; count: number; error: string | null; contactError: string | null; contactStatus: string }

export default function HistorySync({ phoneNumberId }: { phoneNumberId: string }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    api<Status>(`/api/whatsapp/history?phoneNumberId=${encodeURIComponent(phoneNumberId)}`, { signal: controller.signal })
      .then(setStatus)
      .catch(cause => { if (cause.name !== 'AbortError') setError(cause.message) })
    return () => controller.abort()
  }, [phoneNumberId])

  async function start() {
    setBusy(true)
    setError('')
    try {
      const retry = status?.status === 'failed' || status?.contactStatus === 'failed'
      setStatus(await api<Status>('/api/whatsapp/history', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumberId, retry }) }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start history import.')
    } finally {
      setBusy(false)
    }
  }

  const canStart = status && (['not_started', 'failed'].includes(status.status) || status.contactStatus === 'failed')
  const receiving = status?.status === 'receiving'
  const message = !status ? 'Checking shared history…'
    : receiving ? `${status.count} messages saved · ${status.progress}% received`
    : status.status === 'requested' ? 'History requested — waiting for Meta.'
    : 'Import the history shared from WhatsApp Business.'
  const issue = error || status?.error || status?.contactError

  return <section className={`border-b px-4 py-2.5 ${issue ? 'border-red-100 bg-red-50' : 'border-blue-100 bg-blue-50/60'}`}>
    <div className="flex flex-wrap items-center gap-3">
      <span className={`grid size-7 shrink-0 place-items-center rounded-md ${issue ? 'bg-red-100 text-red-600' : 'bg-white text-trust ring-1 ring-blue-100'}`}>{issue ? <AlertCircle className="size-3.5" /> : receiving || !status ? <LoaderCircle className="size-3.5 animate-spin" /> : <DownloadCloud className="size-3.5" />}</span>
      <div className="min-w-0 flex-1"><p role="status" className={`text-xs font-medium ${issue ? 'text-red-700' : 'text-navy'}`}>{issue || message}</p>{receiving && <div className="mt-1.5 h-1 max-w-xs overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-trust transition-[width]" style={{ width: `${Math.min(100, status.progress)}%` }} /></div>}</div>
      {canStart && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={start} className="text-trust hover:bg-blue-100">{busy ? 'Requesting…' : 'Import history'}</Button>}
    </div>
  </section>
}
