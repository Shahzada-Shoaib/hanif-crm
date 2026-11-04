import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, RefreshCw, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/services/api'
import type { Bootstrap, Connection } from '@/types'

type Settings = { url: string | null; tokenConfigured: boolean; jobs: { wabaId: string; status: string; error: string | null }[]; connections: Connection[] }

export default function OnboardPage({ data, onConnections }: { data: Bootstrap; onConnections: (items: Connection[]) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [companyId, setCompanyId] = useState(data.companies[0]?.id || '')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deleting, setDeleting] = useState('')
  const [starting, setStarting] = useState(false)
  const [checking, setChecking] = useState(false)
  const pollGeneration = useRef(0)

  useEffect(() => {
    const generation = ++pollGeneration.current
    if (!companyId) return
    api<Settings>(`/api/whatsapp/hosted?companyId=${encodeURIComponent(companyId)}`)
      .then(result => { setSettings(result); onConnections(result.connections) })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load WhatsApp setup.'))
    return () => { if (pollGeneration.current === generation) pollGeneration.current += 1 }
  }, [companyId, onConnections])

  const companyConnections = data.connections.filter(item => item.companyId === companyId)

  async function reconcile(selectedCompanyId: string) {
    const result = await api<Settings>('/api/whatsapp/hosted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: selectedCompanyId }),
    })
    setSettings(result)
    onConnections(result.connections)
    return result
  }

  async function pollForConnection(selectedCompanyId: string, existingIds: Set<string>, generation: number) {
    setChecking(true)
    setNotice('Waiting for Meta to finish connecting the number...')
    const deadline = Date.now() + 15 * 60 * 1000
    try {
      while (Date.now() < deadline && pollGeneration.current === generation) {
        await new Promise(resolve => window.setTimeout(resolve, 4000))
        if (pollGeneration.current !== generation) return
        const result = await reconcile(selectedCompanyId)
        const latestJob = result.jobs[0]
        const imported = result.connections.some(item => item.companyId === selectedCompanyId && !existingIds.has(item.phoneNumberId))
        if (imported || latestJob?.status === 'complete') {
          setError('')
          setNotice('WhatsApp number connected successfully.')
          return
        }
        if (latestJob?.status === 'failed') {
          throw new Error(latestJob.error || 'Meta could not finish connecting this number.')
        }
      }
      if (pollGeneration.current === generation) throw new Error('Connection check timed out. You can use Check connection to try again.')
    } catch (cause) {
      if (pollGeneration.current === generation) {
        setNotice('')
        setError(cause instanceof Error ? cause.message : 'Could not check the WhatsApp connection.')
      }
    } finally {
      if (pollGeneration.current === generation) setChecking(false)
    }
  }

  async function checkConnection() {
    if (!companyId) return
    const generation = ++pollGeneration.current
    setChecking(true); setError(''); setNotice('Checking Meta onboarding status...')
    try {
      const result = await reconcile(companyId)
      if (pollGeneration.current !== generation) return
      const latestJob = result.jobs[0]
      if (latestJob?.status === 'failed') throw new Error(latestJob.error || 'Meta could not finish connecting this number.')
      if (latestJob?.status === 'complete') setNotice('WhatsApp number connected successfully.')
      else setNotice('Meta has not completed onboarding yet. Finish the Meta steps, then check again.')
    } catch (cause) {
      if (pollGeneration.current === generation) {
        setNotice('')
        setError(cause instanceof Error ? cause.message : 'Could not check the WhatsApp connection.')
      }
    } finally {
      if (pollGeneration.current === generation) setChecking(false)
    }
  }

  async function openMeta() {
    if (!companyId) return
    const popup = window.open('', '_blank')
    const selectedCompanyId = companyId
    const existingIds = new Set(data.connections.filter(item => item.companyId === selectedCompanyId).map(item => item.phoneNumberId))
    const generation = ++pollGeneration.current
    setStarting(true); setError(''); setNotice('')
    try {
      const result = await api<{ url: string }>('/api/whatsapp/hosted/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: selectedCompanyId }) })
      if (popup) { popup.opener = null; popup.location.href = result.url } else window.location.href = result.url
      if (popup) void pollForConnection(selectedCompanyId, existingIds, generation)
    } catch (cause) {
      popup?.close()
      setError(cause instanceof Error ? cause.message : 'Could not start Meta onboarding.')
    } finally { setStarting(false) }
  }

  async function deleteNumber(number: Connection) {
    if (!window.confirm(`Permanently delete ${number.displayPhone} and all of its CRM data?`)) return
    setDeleting(number.phoneNumberId); setError('')
    try {
      const result = await api<{ connections: Connection[] }>(`/api/whatsapp/connections/${number.phoneNumberId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: 'DELETE ALL DATA' }) })
      onConnections(result.connections)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete this number.') } finally { setDeleting('') }
  }

  return <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-base font-semibold text-navy">WhatsApp setup</h1><p className="mt-0.5 text-xs text-slate-500">Connect a number to a company.</p></div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select aria-label="Company for WhatsApp setup" value={companyId} onChange={event => setCompanyId(event.target.value)} className="h-8 min-w-44 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-navy outline-none focus:border-trust">
          <option value="">Select company</option>{data.companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
        </select>
        <Button type="button" variant="outline" disabled={!companyId || checking || starting} onClick={() => void checkConnection()}>{checking ? 'Checking...' : 'Check connection'} <RefreshCw className={checking ? 'animate-spin' : ''} /></Button>
        <Button type="button" disabled={!companyId || !settings?.url || starting || checking} onClick={() => void openMeta()}>{starting ? 'Opening...' : 'Connect number'} <ExternalLink /></Button>
      </div>
    </div>

    {error && <Alert variant="destructive" className="mt-4"><AlertTriangle /><AlertDescription>{error}</AlertDescription></Alert>}
    {notice && !error && <Alert className="mt-4"><CheckCircle2 /><AlertDescription>{notice}</AlertDescription></Alert>}
    {settings && !settings.tokenConfigured && <Alert variant="destructive" className="mt-4"><AlertTriangle /><AlertDescription>Automatic setup needs a system-user token configured on the FastAPI server.</AlertDescription></Alert>}

    <section className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-navy">Connected numbers</h2><span className="font-mono text-[10px] text-slate-400">{companyConnections.length}</span></div>
      {companyConnections.length ? <Table><TableHeader><TableRow className="bg-slate-50/70"><TableHead>Number</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead className="w-12" /></TableRow></TableHeader><TableBody>{companyConnections.map(number => <TableRow key={number.phoneNumberId}><TableCell className="font-mono text-xs">{number.displayPhone}</TableCell><TableCell>{number.verifiedName}</TableCell><TableCell><span className={number.webhookSubscribed ? 'text-teal' : 'text-amber-700'}>{number.webhookSubscribed ? <><CheckCircle2 className="mr-1 inline size-3.5" />Active</> : 'Needs attention'}</span></TableCell><TableCell className="text-right"><Button type="button" variant="ghost" size="icon-sm" title="Delete number" aria-label={`Delete ${number.displayPhone}`} disabled={Boolean(deleting)} onClick={() => void deleteNumber(number)} className="text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 /></Button></TableCell></TableRow>)}</TableBody></Table> : <div className="px-4 py-10 text-center"><p className="text-sm text-slate-500">No connected numbers.</p></div>}
    </section>
  </div>
}
