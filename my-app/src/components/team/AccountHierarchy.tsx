import { Ban, Building2, CheckCircle2, ChevronRight, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import type { Company, CurrentUser } from '@/types'
import { Button } from '@/components/ui/button'
import UserStatusBadge from './UserStatusBadge'

type Props = {
  companies: Company[]
  users: CurrentUser[]
  query: string
  busyUserId: string
  onStatusChange: (user: CurrentUser) => void
}

export default function AccountHierarchy({ companies, users, query, busyUserId, onStatusChange }: Props) {
  const needle = query.trim().toLowerCase()
  const groups = companies.map(company => {
    const companyUsers = users.filter(user => user.companyIds?.includes(company.id))
    const admins = companyUsers.filter(user => user.role === 'admin')
    const members = companyUsers.filter(user => user.role === 'user')
    const matches = !needle || company.name.toLowerCase().includes(needle) || companyUsers.some(user => `${user.displayName} ${user.username}`.toLowerCase().includes(needle))
    return { company, admins, members, matches }
  }).filter(group => group.matches)

  if (!groups.length) return <EmptyHierarchy query={query} />

  return <div className="space-y-3">{groups.map((group, companyIndex) => <details key={`${group.company.id}-${needle}`} className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.03)]" {...(needle ? { open: true } : { defaultOpen: companyIndex === 0 })}>
    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 hover:bg-slate-50 sm:px-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-trust"><Building2 className="size-4" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-navy">{group.company.name}</span><span className="mt-0.5 block text-[10px] text-slate-400">{group.admins.length} admin · {group.members.length} user{group.members.length === 1 ? '' : 's'}</span></span>
      <ChevronRight className="size-4 text-slate-400 transition-transform group-open:rotate-90" />
    </summary>
    <div className="border-t border-slate-100 bg-slate-50/45 p-3 sm:p-4">
      {group.admins.length ? <div className="space-y-3">{group.admins.map(admin => {
        const ownedUsers = group.members.filter(user => user.createdBy === admin.id)
        return <section key={admin.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <AccountRow user={admin} icon="admin" detail={`${ownedUsers.length} user${ownedUsers.length === 1 ? '' : 's'} added`} busy={busyUserId === admin.id} onStatusChange={onStatusChange} />
          <div className="border-t border-slate-100 bg-slate-50/35 pl-4 sm:pl-12">
            {ownedUsers.length ? ownedUsers.map(user => <AccountRow key={user.id} user={user} icon="user" busy={busyUserId === user.id} onStatusChange={onStatusChange} nested />) : <p className="px-4 py-3 text-xs text-slate-400">No users added by this admin yet.</p>}
          </div>
        </section>
      })}</div> : <p className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-xs text-slate-500">No active admin account found for this company.</p>}
      {group.members.some(user => !user.createdBy || !group.admins.some(admin => admin.id === user.createdBy)) && <div className="mt-3 rounded-lg border border-amber-200/70 bg-amber-50/50"><div className="flex items-center gap-2 border-b border-amber-100 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700"><UsersRound className="size-3.5" />Unassigned users</div>{group.members.filter(user => !user.createdBy || !group.admins.some(admin => admin.id === user.createdBy)).map(user => <AccountRow key={user.id} user={user} icon="user" busy={busyUserId === user.id} onStatusChange={onStatusChange} nested />)}</div>}
    </div>
  </details>)}</div>
}

function AccountRow({ user, icon, detail, busy, nested, onStatusChange }: { user: CurrentUser; icon: 'admin' | 'user'; detail?: string; busy: boolean; nested?: boolean; onStatusChange: (user: CurrentUser) => void }) {
  return <div className={`flex min-w-0 items-center gap-3 px-3 py-3 sm:px-4 ${nested ? 'border-b border-slate-100 last:border-b-0' : ''}`}>
    <span className={`grid shrink-0 place-items-center rounded-md ${nested ? 'size-7 bg-white text-slate-400 shadow-sm' : 'size-9 bg-navy text-blue-100'}`}>{icon === 'admin' ? <ShieldCheck className="size-4" /> : <UserRound className="size-3.5" />}</span>
    <span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-2"><span className="truncate text-xs font-semibold text-navy">{user.displayName}</span><UserStatusBadge user={user} /></span><span className="mt-0.5 block truncate font-mono text-[9px] text-slate-400">@{user.username}{detail ? ` · ${detail}` : ''}</span></span>
    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onStatusChange(user)} aria-label={`${user.status === 'active' ? 'Disable' : 'Enable'} ${user.displayName}`} className={`shrink-0 ${user.status === 'active' ? 'text-red-600 hover:bg-red-50 hover:text-red-700' : 'text-teal hover:bg-teal/10 hover:text-teal'}`}>{user.status === 'active' ? <Ban /> : <CheckCircle2 />}<span className="hidden sm:inline">{user.status === 'active' ? 'Disable' : 'Enable'}</span></Button>
  </div>
}

function EmptyHierarchy({ query }: { query: string }) {
  return <div className="grid min-h-52 place-items-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center"><div><UsersRound className="mx-auto size-8 text-slate-300" /><p className="mt-3 text-sm font-semibold text-navy">{query ? 'No matching accounts' : 'No registered companies yet'}</p><p className="mt-1 text-xs text-slate-500">{query ? 'Try another company, admin or username.' : 'New registrations will appear here automatically.'}</p></div></div>
}
