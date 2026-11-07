import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import './App.css'
import AppShell from './components/layout/AppShell'
import { Skeleton } from './components/ui/skeleton'
import { api } from './services/api'
import type { Bootstrap, Connection, CurrentUser } from './types'

const CompaniesPage = lazy(() => import('./pages/CompaniesPage'))
const AccountsPage = lazy(() => import('./pages/AccountsPage'))
const InboxPage = lazy(() => import('./pages/InboxPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const OnboardPage = lazy(() => import('./pages/OnboardPage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const TeamPage = lazy(() => import('./pages/TeamPage'))

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [data, setData] = useState<Bootstrap | null>(null)
  const [error, setError] = useState('')
  const [inboxCompanyId, setInboxCompanyId] = useState('all')
  const [inboxPhoneNumberId, setInboxPhoneNumberId] = useState('')

  useEffect(() => {
    api<{ authenticated: boolean; user: CurrentUser | null }>('/api/session')
      .then(result => { setAuthenticated(result.authenticated); setCurrentUser(result.user) })
      .catch(() => setAuthenticated(false))
  }, [])

  useEffect(() => {
    if (!authenticated) return
    api<Bootstrap>('/api/bootstrap')
      .then(result => { setData(result); setCurrentUser(result.user) })
      .catch(cause => setError(cause.message))
  }, [authenticated])

  const updateConnections = useCallback((connections: Connection[]) => {
    setData(current => current ? { ...current, connections } : current)
  }, [])

  const inboxNumbers = data?.connections.filter(connection => inboxCompanyId === 'all' || connection.companyId === inboxCompanyId) || []
  const activeInboxPhoneNumberId = inboxNumbers.some(connection => connection.phoneNumberId === inboxPhoneNumberId)
    ? inboxPhoneNumberId
    : inboxNumbers[0]?.phoneNumberId || ''

  function selectInboxCompany(companyId: string) {
    setInboxCompanyId(companyId)
    const numbers = data?.connections.filter(connection => companyId === 'all' || connection.companyId === companyId) || []
    setInboxPhoneNumberId(numbers[0]?.phoneNumberId || '')
  }

  if (authenticated === null) {
    return <AppShell><WorkspaceState /></AppShell>
  }

  const workspace = !authenticated
    ? <Navigate to="/login" replace />
    : !data
      ? <WorkspaceState error={error} />
      : <InboxPage data={data} phoneNumberId={activeInboxPhoneNumberId} />

  const onboarding = !authenticated
    ? <Navigate to="/login" replace />
    : !data
      ? <WorkspaceState error={error} />
      : <OnboardPage data={data} onConnections={updateConnections} />

  const companies = !authenticated
    ? <Navigate to="/login" replace />
    : !data
      ? <WorkspaceState error={error} />
      : <CompaniesPage data={data} onChange={setData} />

  const team = !authenticated
    ? <Navigate to="/login" replace />
    : !data
      ? <WorkspaceState error={error} />
      : data.user.role !== 'admin'
        ? <Navigate to="/inbox" replace />
        : <TeamPage data={data} />

  return <AppShell
    user={currentUser}
    onLogout={authenticated ? () => { setAuthenticated(false); setCurrentUser(null); setData(null) } : undefined}
    inboxHeader={data ? {
      companies: data.companies,
      connections: data.connections,
      numbers: inboxNumbers,
      companyId: inboxCompanyId,
      phoneNumberId: activeInboxPhoneNumberId,
      onCompanyChange: selectInboxCompany,
      onCompanyAdded: company => {
        setData(current => current ? { ...current, companies: [...current.companies, company].sort((a, b) => a.name.localeCompare(b.name)) } : current)
        setInboxCompanyId(company.id)
        setInboxPhoneNumberId('')
      },
      onPhoneNumberChange: setInboxPhoneNumberId,
      canAddCompany: data.user.role === 'admin',
    } : undefined}
  >
    <Suspense fallback={<WorkspaceState />}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={authenticated ? <Navigate to={currentUser?.role === 'super_admin' ? '/accounts' : '/inbox'} replace /> : <LoginPage onLogin={user => { setCurrentUser(user); setAuthenticated(true) }} />} />
        <Route path="/register" element={authenticated ? <Navigate to="/inbox" replace /> : <RegisterPage onRegister={user => { setCurrentUser(user); setAuthenticated(true) }} />} />
        <Route path="/accounts" element={!authenticated ? <Navigate to="/login" replace /> : currentUser?.role === 'super_admin' ? <AccountsPage /> : <Navigate to="/inbox" replace />} />
        <Route path="/inbox" element={currentUser?.role === 'super_admin' ? <Navigate to="/accounts" replace /> : workspace} />
        <Route path="/onboard-whatsapp" element={currentUser?.role === 'admin' ? onboarding : <Navigate to={currentUser?.role === 'super_admin' ? '/accounts' : '/inbox'} replace />} />
        <Route path="/companies" element={currentUser?.role === 'admin' ? companies : <Navigate to={currentUser?.role === 'super_admin' ? '/accounts' : '/inbox'} replace />} />
        <Route path="/team" element={team} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  </AppShell>
}

function WorkspaceState({ error }: { error?: string }) {
  if (error) return <div className="grid min-h-[calc(100vh-3.5rem)] place-items-center p-6">
    <div className="max-w-md text-center"><span className="mx-auto grid size-11 place-items-center rounded-full bg-red-50 text-red-600"><AlertCircle className="size-5" /></span><h1 className="mt-4 text-lg font-semibold text-navy">Workspace unavailable</h1><p className="mt-1.5 text-sm leading-6 text-slate-500">{error}</p></div>
  </div>

  return <div className="mx-auto w-full max-w-7xl p-5 sm:p-7">
    <div className="flex items-end justify-between border-b border-border pb-5"><div><Skeleton className="h-3 w-24" /><Skeleton className="mt-3 h-8 w-56" /><Skeleton className="mt-2 h-4 w-80 max-w-full" /></div><Skeleton className="hidden h-9 w-28 sm:block" /></div>
    <div className="mt-5 grid min-h-[58vh] grid-cols-1 overflow-hidden rounded-lg border bg-white md:grid-cols-[280px_1fr]"><div className="space-y-3 border-b p-4 md:border-r md:border-b-0">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div><div className="p-6"><Skeleton className="h-full min-h-80 w-full" /></div></div>
  </div>
}
