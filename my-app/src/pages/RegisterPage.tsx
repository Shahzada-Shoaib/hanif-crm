import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, UserPlus } from 'lucide-react'
import { api } from '@/services/api'
import type { CurrentUser } from '@/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RegisterPage({ onRegister }: { onRegister: (user: CurrentUser) => void }) {
  const navigate = useNavigate()
  const [workspaceName, setWorkspaceName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api<{ user: CurrentUser }>('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceName, displayName, username, password }),
      })
      onRegister(result.user)
      navigate('/inbox', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create account.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="grid min-h-screen place-items-center bg-[#f7f9fc] px-5 py-10">
    <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_18px_50px_rgb(23_43_77/0.08)]">
      <div className="border-b border-slate-100 px-6 py-5"><span className="grid size-10 place-items-center rounded-lg bg-blue-50 text-trust"><Building2 className="size-5" /></span><h1 className="mt-4 text-xl font-semibold tracking-tight text-navy">Create your workspace</h1><p className="mt-1 text-sm leading-6 text-slate-500">Create your admin account, then add companies, WhatsApp numbers and team members.</p></div>
      <form className="space-y-4 px-6 py-5" onSubmit={submit}>
        <div className="space-y-2"><Label htmlFor="workspace-name">Business or workspace name</Label><Input id="workspace-name" required minLength={2} maxLength={60} value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} placeholder="e.g. Hanif CRM" /></div>
        <div className="space-y-2"><Label htmlFor="full-name">Your name</Label><Input id="full-name" required minLength={2} maxLength={60} value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="e.g. Shoaib Hanif" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="register-username">Username</Label><Input id="register-username" required minLength={3} maxLength={50} autoComplete="username" value={username} onChange={event => setUsername(event.target.value.toLowerCase())} placeholder="shoaib" /></div>
          <div className="space-y-2"><Label htmlFor="register-password">Password</Label><Input id="register-password" required minLength={8} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="8+ characters" /></div>
        </div>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <Button disabled={busy} size="lg" className="w-full"><UserPlus />{busy ? 'Creating workspace...' : 'Create account'}</Button>
        <p className="text-center text-xs text-slate-500">Already registered? <Link to="/login" className="font-semibold text-trust hover:underline">Sign in</Link></p>
      </form>
    </div>
  </main>
}
