import { useEffect, useMemo, useState } from 'react'
import { Search, UserPlus, UsersRound } from 'lucide-react'
import AddUserDialog from '@/components/team/AddUserDialog'
import UsersTable from '@/components/team/UsersTable'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/services/api'
import type { Bootstrap, CurrentUser } from '@/types'

export default function TeamPage({ data }: { data: Bootstrap }) {
  const [users, setUsers] = useState<CurrentUser[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [busyUserId, setBusyUserId] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    api<{ users: CurrentUser[] }>('/api/users', { signal: controller.signal }).then(result => setUsers(result.users)).catch(cause => { if (cause.name !== 'AbortError') setError(cause instanceof Error ? cause.message : 'Could not load users.') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  const filteredUsers = useMemo(() => { const needle = query.trim().toLowerCase(); return needle ? users.filter(user => `${user.displayName} ${user.username}`.toLowerCase().includes(needle)) : users }, [query, users])

  async function toggleStatus(user: CurrentUser) {
    setBusyUserId(user.id); setError('')
    try {
      const status = user.status === 'active' ? 'disabled' : 'active'
      const result = await api<{ user: CurrentUser }>(`/api/users/${user.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      setUsers(current => current.map(item => item.id === user.id ? { ...result.user, companyIds: item.companyIds } : item))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update user.') } finally { setBusyUserId('') }
  }

  return <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
    {error && <Alert variant="destructive" className="mt-5"><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="mt-5 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="text-sm font-semibold text-navy">Workspace accounts</h2><p className="mt-0.5 text-xs text-slate-500">Your administrator account and team users.</p></div><div className="flex w-full items-center gap-2 sm:w-auto"><div className="relative min-w-0 flex-1 sm:w-64"><Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search accounts" className="h-9 bg-white pl-9 text-xs" /></div><Button onClick={() => setAdding(true)}><UserPlus /> Add user</Button></div></div>
    <div className="mt-3">{loading ? <Skeleton className="h-64 w-full" /> : filteredUsers.length ? <UsersTable actor={data.user} users={filteredUsers} companies={data.companies} busyUserId={busyUserId} onStatusChange={user => void toggleStatus(user)} /> : <div className="grid min-h-52 place-items-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center"><div><UsersRound className="mx-auto size-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-navy">No matching accounts</p><p className="mt-1 text-xs text-slate-500">Try another name or username.</p></div></div>}</div>
    <AddUserDialog open={adding} actor={data.user} companies={data.companies} onClose={() => setAdding(false)} onAdded={user => setUsers(current => [user, ...current])} />
  </div>
}
