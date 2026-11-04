import { useEffect, useState } from 'react'
import { Ban, Building2, CheckCircle2, Smartphone, UserRound, UsersRound } from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/services/api'
import type { RegisteredAccount } from '@/types'

const accountColumns = {
  gridTemplateColumns: '190px 150px 180px 180px 100px 100px',
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<RegisteredAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ accounts: RegisteredAccount[] }>('/api/workspaces')
      .then(result => setAccounts((result.accounts || []).map(account => ({ ...account, users: account.users || [], companyList: account.companyList || [] }))))
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not load registered users.'))
      .finally(() => setLoading(false))
  }, [])

  async function toggleStatus(account: RegisteredAccount) {
    const status = account.status === 'active' ? 'disabled' : 'active'
    setBusyId(account.id); setError('')
    try {
      await api(`/api/workspaces/${account.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      setAccounts(current => current.map(item => item.id === account.id ? { ...item, status } : item))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update account.')
    } finally { setBusyId('') }
  }

  const activeAccounts = accounts.filter(account => account.status === 'active').length
  const connectedNumbers = accounts.reduce((sum, account) => sum + account.connections, 0)

  return <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
    <PageHeader eyebrow="Platform overview" title="Registered users" description="Every registered account with its workspace, team and companies in one row." />
    {error && <Alert variant="destructive" className="mt-5"><AlertDescription>{error}</AlertDescription></Alert>}

    <div className="mt-5 grid gap-4 sm:grid-cols-3">
      <Metric icon={UsersRound} value={accounts.length} label="Registered users" />
      <Metric icon={CheckCircle2} value={activeAccounts} label="Active accounts" />
      <Metric icon={Smartphone} value={connectedNumbers} label="WhatsApp numbers" />
    </div>

    <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.03)]">
      <div className="min-w-[980px]">
        <div style={accountColumns} className="grid items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          <span>User</span><span>Workspace</span><span>Team users</span><span>Companies</span><span className="text-right">Registered</span><span className="text-right">Status</span>
        </div>

        {loading ? <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div> : accounts.length ? accounts.map(account => {
          const userNames = account.users.map(user => user.displayName).join(', ')
          const companyNames = account.companyList.map(company => company.name).join(', ')
          return <div key={account.id} style={accountColumns} className="grid min-h-14 items-center gap-2 border-b border-slate-100 px-4 py-2 last:border-b-0">
            <div className="flex min-w-0 items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-trust"><UserRound className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-navy">{account.displayName}</span><span className="block truncate font-mono text-[10px] text-slate-400">@{account.username}</span></span></div>
            <div className="flex min-w-0 items-center gap-2"><Building2 className="size-3.5 shrink-0 text-slate-400" /><span className="truncate text-xs text-slate-600" title={account.workspaceName}>{account.workspaceName}</span></div>
            <span className={`truncate text-xs ${userNames ? 'text-slate-600' : 'text-slate-400'}`} title={userNames}>{userNames || 'No users'}</span>
            <span className={`truncate text-xs ${companyNames ? 'text-slate-600' : 'text-slate-400'}`} title={companyNames}>{companyNames || 'No companies'}</span>
            <span className="text-right font-mono text-[10px] text-slate-400">{new Date(account.createdAt).toLocaleDateString()}</span>
            <div className="text-right"><Button type="button" size="sm" variant="ghost" disabled={busyId === account.id} onClick={() => void toggleStatus(account)} className={account.status === 'active' ? 'text-red-600 hover:bg-red-50' : 'text-teal hover:bg-teal/10'}>{account.status === 'active' ? <Ban /> : <CheckCircle2 />}{account.status === 'active' ? 'Disable' : 'Enable'}</Button></div>
          </div>
        }) : <div className="grid min-h-52 place-items-center p-8 text-center"><div><UsersRound className="mx-auto size-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-navy">No registered users yet</p><p className="mt-1 text-xs text-slate-500">New registrations will appear here.</p></div></div>}
      </div>
    </div>
  </div>
}

function Metric({ icon: Icon, value, label }: { icon: typeof UsersRound; value: number; label: string }) {
  return <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"><span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-trust"><Icon className="size-4" /></span><span><span className="block text-lg font-semibold leading-none text-navy">{value}</span><span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.1em] text-slate-400">{label}</span></span></div>
}
