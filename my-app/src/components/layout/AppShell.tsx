import { useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Building2,
  Check,
  ChevronDown,
  ChevronsUpDown,
  CircleHelp,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  PlugZap,
  Search,
  Smartphone,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import { api } from '@/services/api'
import AddCompanyModal from '@/components/companies/AddCompanyModal'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Company, Connection, CurrentUser, UserRole } from '@/types'
import { Brand, BrandMark } from './Brand'

const navigation: { to: string; label: string; description: string; icon: LucideIcon; roles?: UserRole[] }[] = [
  { to: '/accounts', label: 'Accounts', description: 'Registered workspaces', icon: LayoutDashboard, roles: ['super_admin'] },
  { to: '/inbox', label: 'Inbox', description: 'Customer conversations', icon: Inbox, roles: ['admin', 'user'] },
  { to: '/companies', label: 'Companies', description: 'Groups and assignments', icon: Building2, roles: ['admin'] },
  { to: '/team', label: 'Team', description: 'Users and access', icon: UsersRound, roles: ['admin'] },
  { to: '/onboard-whatsapp', label: 'WhatsApp setup', description: 'Channels and webhooks', icon: PlugZap, roles: ['admin'] },
]

const publicRoutes = new Set(['/', '/login', '/register', '/privacy'])

type InboxHeader = {
  companies: Company[]
  connections: Connection[]
  numbers: Connection[]
  companyId: string
  phoneNumberId: string
  onCompanyChange: (companyId: string) => void
  onCompanyAdded: (company: Company) => void
  onPhoneNumberChange: (phoneNumberId: string) => void
  canAddCompany: boolean
}

export default function AppShell({ children, user, onLogout, inboxHeader }: { children: ReactNode; user?: CurrentUser | null; onLogout?: () => void; inboxHeader?: InboxHeader }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()

  async function signOut() {
    try {
      await api('/api/session', { method: 'DELETE' })
      onLogout?.()
      navigate('/login', { replace: true })
    } catch {
      window.alert('Could not sign out. Please try again.')
    }
  }

  if (pathname === '/' || pathname === '/login' || pathname === '/register') return children

  if (publicRoutes.has(pathname)) {
    return <div className="flex min-h-screen flex-col bg-white">
      <header className="relative z-20 border-b border-slate-200/80 bg-white/95">
        <div className="mx-auto flex h-18 w-full max-w-7xl items-center justify-between px-5 lg:px-8">
          <Brand />
          <nav className="flex items-center gap-1" aria-label="Public navigation">
            <Button variant="ghost" size="sm" asChild className="hidden text-slate-600 sm:inline-flex"><Link to="/privacy">Privacy</Link></Button>
            <Button size="sm" asChild><Link to={onLogout ? '/inbox' : '/login'}>{onLogout ? 'Open workspace' : 'Sign in'}</Link></Button>
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <footer className="border-t border-slate-200 bg-slate-50/70">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-5 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© 2026 Hanif CRM. WhatsApp operations for focused teams.</p>
          <Link to="/privacy" className="font-medium text-slate-600 hover:text-navy">Privacy policy</Link>
        </div>
      </footer>
    </div>
  }

  const allowedNavigation = navigation.filter(item => !item.roles || (user && item.roles.includes(user.role)))
  const current = allowedNavigation.find(item => item.to === pathname)

  return <div className="min-h-screen bg-background lg:flex">
    <aside className={cn('sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex', collapsed ? 'w-[76px]' : 'w-[248px]')}>
      <div className={cn('flex h-20 items-center border-b border-sidebar-border px-4', collapsed ? 'justify-center' : 'justify-between')}>
        {collapsed ? <BrandMark /> : <Brand dark />}
        {!collapsed && <Button variant="ghost" size="icon-sm" onClick={() => setCollapsed(true)} className="text-blue-100/55 hover:bg-sidebar-accent hover:text-white" aria-label="Collapse navigation"><PanelLeftClose /></Button>}
      </div>

      {collapsed && <div className="flex justify-center px-3 pt-4">
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(false)} className="text-blue-100/60 hover:bg-sidebar-accent hover:text-white" aria-label="Expand navigation"><PanelLeftOpen /></Button>
      </div>}

      <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Workspace navigation">
        {!collapsed && <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-200/45">Workspace</p>}
        {allowedNavigation.map(item => <WorkspaceNavItem key={item.to} {...item} active={pathname === item.to} collapsed={collapsed} />)}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <UserMenu collapsed={collapsed} user={user} onSignOut={signOut} />
      </div>
    </aside>

    <div className="flex min-h-screen min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200/90 bg-white/95 px-3 backdrop-blur sm:px-5 lg:px-7">
        <div className="flex items-center gap-3 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild><Button variant="outline" size="icon" aria-label="Open navigation"><Menu /></Button></SheetTrigger>
            <SheetContent side="left" className="w-[290px] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
              <SheetTitle className="sr-only">Workspace navigation</SheetTitle>
              <div className="flex h-20 items-center border-b border-sidebar-border px-5"><Brand dark /></div>
              <nav className="space-y-1 px-3 py-5">
                <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-200/45">Workspace</p>
                {allowedNavigation.map(item => <WorkspaceNavItem key={item.to} {...item} active={pathname === item.to} collapsed={false} onNavigate={() => setMobileOpen(false)} />)}
              </nav>
              <div className="absolute inset-x-3 bottom-4"><UserMenu collapsed={false} user={user} onSignOut={signOut} /></div>
            </SheetContent>
          </Sheet>
          {pathname !== '/inbox' && <Brand compact />}
        </div>
        <div className={cn('hidden min-w-0 items-center gap-2 lg:flex', pathname === '/inbox' && 'lg:hidden')}>
          <span className="text-xs font-medium text-slate-400">Hanif CRM</span><span className="text-slate-300">/</span><span className="truncate text-xs font-semibold text-navy">{current?.label || 'Workspace'}</span>
        </div>
        {pathname === '/inbox' && inboxHeader && <InboxHeaderControls config={inboxHeader} />}
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {pathname !== '/inbox' && <Button variant="ghost" size="sm" className="hidden text-slate-500 sm:inline-flex"><CircleHelp /> Help</Button>}
          {pathname !== '/inbox' && <span className="hidden h-5 w-px bg-slate-200 sm:block" />}
          <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-1.5 py-1 shadow-xs sm:pr-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-navy text-[9px] font-semibold text-white">{profileInitials(user)}</span>
            <span className="hidden min-w-0 sm:block"><span className="block max-w-28 truncate text-[11px] font-semibold leading-4 text-navy">{user?.displayName || 'CRM user'}</span><span className="block text-[8px] leading-3 text-slate-400">{profileRole(user)}</span></span>
          </div>
        </div>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  </div>
}

function InboxHeaderControls({ config }: { config: InboxHeader }) {
  const [companyOpen, setCompanyOpen] = useState(false)
  const [numberOpen, setNumberOpen] = useState(false)
  const [addingCompany, setAddingCompany] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const companyLabel = config.companyId === 'all'
    ? 'All companies'
    : config.companies.find(company => company.id === config.companyId)?.name || 'Company'
  const selectedNumber = config.numbers.find(number => number.phoneNumberId === config.phoneNumberId)
  const filteredCompanies = config.companies.filter(company => company.name.toLowerCase().includes(query.trim().toLowerCase()))

  return <>
    <div className="ml-2 flex min-w-0 items-center gap-2 lg:ml-0 lg:gap-4">
      <DropdownMenu open={companyOpen} onOpenChange={open => { setCompanyOpen(open); if (open) requestAnimationFrame(() => searchRef.current?.focus()); else setQuery('') }}>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Select company" className="group flex h-11 w-[130px] min-w-0 items-center gap-2 rounded-lg bg-slate-50 px-2.5 text-left outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-trust/30 data-[state=open]:bg-blue-50 data-[state=open]:shadow-inner sm:w-[190px] lg:h-14 lg:w-[232px] lg:rounded-none lg:bg-slate-50/80 lg:px-4">
            <Building2 className="size-4 shrink-0 text-trust lg:size-5" />
            <span className="min-w-0 flex-1"><span className="block text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-400 lg:text-[9px]">Company</span><span className="mt-0.5 block truncate text-xs font-semibold text-navy lg:text-sm">{companyLabel}</span></span>
            <ChevronDown className="size-3.5 shrink-0 text-navy transition-transform group-data-[state=open]:rotate-180" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" sideOffset={0} align="start" className="w-[292px] overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-[0_18px_50px_rgb(23_43_77/0.18)]">
          <div className="px-3.5 pt-3.5 pb-2"><p className="text-sm font-semibold text-navy">Switch company</p><div className="relative mt-2.5"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" /><Input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => event.stopPropagation()} placeholder="Search companies…" className="h-10 bg-slate-50 pl-9 text-xs" /></div></div>
          <div className="max-h-72 overflow-y-auto p-2">
            <CompanyMenuItem name="All companies" detail={`${config.connections.length} channel${config.connections.length === 1 ? '' : 's'} · Combined inbox`} selected={config.companyId === 'all'} onSelect={() => config.onCompanyChange('all')} />
            {filteredCompanies.map(company => { const count = config.connections.filter(connection => connection.companyId === company.id).length; return <CompanyMenuItem key={company.id} name={company.name} detail={`${count} channel${count === 1 ? '' : 's'}`} selected={config.companyId === company.id} onSelect={() => config.onCompanyChange(company.id)} /> })}
            {!filteredCompanies.length && query && <p className="px-3 py-5 text-center text-xs text-slate-400">No matching companies</p>}
          </div>
          {config.canAddCompany && <><DropdownMenuSeparator className="m-0" /><DropdownMenuItem onSelect={() => setAddingCompany(true)} className="m-2 h-10 cursor-pointer gap-3 px-3 font-semibold text-navy"><Plus className="size-4 text-trust" />Add company</DropdownMenuItem></>}
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="hidden h-7 w-px bg-slate-200 lg:block" />
      <span className="hidden text-sm font-semibold text-navy lg:block">Inbox</span>

      <DropdownMenu open={numberOpen} onOpenChange={setNumberOpen}>
        <DropdownMenuTrigger asChild>
          <button type="button" disabled={!config.numbers.length} aria-label="Select WhatsApp number" className="group flex h-11 w-[142px] min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-left shadow-xs outline-none transition hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal/25 disabled:cursor-not-allowed disabled:opacity-55 data-[state=open]:border-teal/30 data-[state=open]:bg-teal-50/50 sm:w-[190px] lg:h-11 lg:w-[220px]">
            <Smartphone className="size-4 shrink-0 text-teal" />
            <span className="min-w-0 flex-1"><span className="block text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400">WhatsApp number</span><span className="mt-0.5 block truncate text-xs font-semibold text-navy">{selectedNumber?.displayPhone || 'No numbers'}</span></span>
            <ChevronDown className="size-3.5 shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-180" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" sideOffset={6} align="start" className="w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgb(23_43_77/0.18)]">
          <DropdownMenuLabel className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">WhatsApp channels</DropdownMenuLabel>
          {config.numbers.map(number => <DropdownMenuItem key={number.phoneNumberId} onSelect={() => config.onPhoneNumberChange(number.phoneNumberId)} className={cn('cursor-pointer gap-3 px-2.5 py-2.5', config.phoneNumberId === number.phoneNumberId && 'bg-teal-50')}><span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', config.phoneNumberId === number.phoneNumberId ? 'bg-teal text-white' : 'bg-slate-100 text-slate-500')}><Smartphone className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate font-mono text-xs font-semibold text-navy">{number.displayPhone}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{number.verifiedName}</span></span>{config.phoneNumberId === number.phoneNumberId && <Check className="size-4 text-teal" />}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    {config.canAddCompany && <AddCompanyModal open={addingCompany} onClose={() => setAddingCompany(false)} onAdded={company => { config.onCompanyAdded(company); setAddingCompany(false) }} />}
  </>
}

function CompanyMenuItem({ name, detail, selected, onSelect }: { name: string; detail: string; selected: boolean; onSelect: () => void }) {
  return <DropdownMenuItem onSelect={onSelect} className={cn('cursor-pointer gap-3 px-3 py-2.5', selected && 'bg-blue-50')}><Building2 className={cn('size-4 shrink-0', selected ? 'text-trust' : 'text-slate-400')} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-navy">{name}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{detail}</span></span>{selected && <Check className="size-4 shrink-0 text-trust" />}</DropdownMenuItem>
}

function WorkspaceNavItem({ to, label, description, icon: Icon, active, collapsed, onNavigate }: { to: string; label: string; description: string; icon: LucideIcon; active: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const link = <Link to={to} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={cn('group relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring', active ? 'bg-white text-navy shadow-sm' : 'text-blue-100/65 hover:bg-sidebar-accent hover:text-white', collapsed && 'justify-center px-0')}>
    {active && !collapsed && <span className="absolute -left-3 h-5 w-0.5 rounded-r bg-blue-400" />}
    <Icon className={cn('size-[18px] shrink-0', active ? 'text-trust' : 'text-blue-200/55 group-hover:text-blue-100')} />
    {!collapsed && <span className="min-w-0"><span className="block font-semibold leading-4">{label}</span><span className={cn('mt-0.5 block truncate text-[10px] font-normal', active ? 'text-slate-500' : 'text-blue-100/40')}>{description}</span></span>}
  </Link>

  if (!collapsed) return link
  return <Tooltip><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right" sideOffset={8}>{label}</TooltipContent></Tooltip>
}

function UserMenu({ collapsed, user, onSignOut }: { collapsed: boolean; user?: CurrentUser | null; onSignOut: () => Promise<void> }) {
  const initials = profileInitials(user)
  const roleLabel = profileRole(user)
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button type="button" className={cn('flex w-full items-center gap-3 rounded-lg p-2 text-left text-blue-100/70 outline-none transition hover:bg-sidebar-accent hover:text-white focus-visible:ring-2 focus-visible:ring-sidebar-ring', collapsed && 'justify-center')}>
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-blue-400/15 text-xs font-semibold text-blue-100">{initials}</span>
        {!collapsed && <><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-white">{user?.displayName || 'CRM user'}</span><span className="mt-0.5 block text-[10px] text-blue-100/40">{roleLabel}</span></span><ChevronsUpDown className="size-3.5 text-blue-100/40" /></>}
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent side={collapsed ? 'right' : 'top'} align="start" className="w-56">
      <DropdownMenuLabel><span className="block text-xs">{user?.displayName || 'CRM user'}</span><span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">@{user?.username || 'user'} · {roleLabel}</span></DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onClick={() => void onSignOut()}><LogOut /> Sign out</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
}

function profileInitials(user?: CurrentUser | null) {
  return (user?.displayName || 'User').split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
}

function profileRole(user?: CurrentUser | null) {
  return user?.role === 'super_admin' ? 'Super admin' : user?.role === 'admin' ? 'Company admin' : 'Team user'
}
