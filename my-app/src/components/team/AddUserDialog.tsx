import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { api } from '@/services/api'
import type { Company, CurrentUser } from '@/types'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = { open: boolean; actor: CurrentUser; companies: Company[]; onClose: () => void; onAdded: (user: CurrentUser) => void }

export default function AddUserDialog({ open, actor, companies, onClose, onAdded }: Props) {
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [companyIds, setCompanyIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = await api<{ user: CurrentUser }>('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName, username, password, companyIds }) })
      onAdded(result.user)
      setDisplayName(''); setUsername(''); setPassword(''); setCompanyIds([])
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create user.')
    } finally { setBusy(false) }
  }

  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) { setError(''); onClose() } }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Add team account</DialogTitle><DialogDescription>Create a login and choose the companies it can access.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2"><Label htmlFor="team-name">Full name</Label><Input id="team-name" required minLength={2} maxLength={60} value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="e.g. Ali Khan" /></div>
        <div className="space-y-2"><Label htmlFor="team-username">Username</Label><Input id="team-username" required minLength={3} maxLength={50} autoComplete="off" value={username} onChange={event => setUsername(event.target.value.toLowerCase())} placeholder="e.g. ali.khan" /></div>
        <div className="space-y-2"><Label htmlFor="team-password">Temporary password</Label><Input id="team-password" required minLength={8} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" /></div>
        <div className="space-y-2"><Label>Company access</Label><div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">{companies.length ? companies.map(company => <label key={company.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50"><input type="checkbox" checked={companyIds.includes(company.id)} onChange={event => setCompanyIds(current => event.target.checked ? [...current, company.id] : current.filter(id => id !== company.id))} className="accent-blue-600" />{company.name}</label>) : <p className="px-2 py-2 text-xs text-slate-400">Create a company first.</p>}</div></div>
        {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy || !actor.workspaceId || !companyIds.length}><UserPlus />{busy ? 'Creating...' : 'Create account'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
