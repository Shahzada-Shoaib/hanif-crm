import { Ban, CheckCircle2, UserRound } from 'lucide-react'
import type { Company, CurrentUser } from '@/types'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import UserStatusBadge from './UserStatusBadge'

type Props = {
  actor: CurrentUser
  users: CurrentUser[]
  companies: Company[]
  busyUserId: string
  onStatusChange: (user: CurrentUser) => void
}

export default function UsersTable({ actor, users, companies, busyUserId, onStatusChange }: Props) {
  const companyNames = new Map(companies.map(company => [company.id, company.name]))
  return <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.03)]">
    <Table>
      <TableHeader><TableRow className="bg-slate-50/80"><TableHead>Account</TableHead><TableHead>Access</TableHead><TableHead className="hidden md:table-cell">Company</TableHead><TableHead className="hidden text-right sm:table-cell">Created</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
      <TableBody>{users.map(user => {
        const canManage = user.id !== actor.id && user.role === 'user'
        return <TableRow key={user.id}>
          <TableCell><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><UserRound className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-semibold text-navy">{user.displayName}</span><span className="block truncate font-mono text-[10px] text-slate-400">@{user.username}</span></span></div></TableCell>
          <TableCell><UserStatusBadge user={user} /></TableCell>
          <TableCell className="hidden text-xs text-slate-500 md:table-cell">{user.role === 'admin' ? 'All companies' : (user.companyIds || []).map(id => companyNames.get(id)).filter(Boolean).join(', ') || 'No access'}</TableCell>
          <TableCell className="hidden text-right font-mono text-[10px] text-slate-400 sm:table-cell">{new Date(user.createdAt).toLocaleDateString()}</TableCell>
          <TableCell className="text-right">{canManage && <Button type="button" size="sm" variant="ghost" disabled={busyUserId === user.id} onClick={() => onStatusChange(user)} className={user.status === 'active' ? 'text-red-600 hover:bg-red-50 hover:text-red-700' : 'text-teal hover:bg-teal/10 hover:text-teal'}>{user.status === 'active' ? <Ban /> : <CheckCircle2 />}{user.status === 'active' ? 'Disable' : 'Enable'}</Button>}</TableCell>
        </TableRow>
      })}</TableBody>
    </Table>
  </div>
}
