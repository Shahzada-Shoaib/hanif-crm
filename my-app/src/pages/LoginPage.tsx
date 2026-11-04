import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/services/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CurrentUser } from '@/types'

export default function LoginPage({ onLogin }: { onLogin: (user: CurrentUser) => void }) {
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const result = await api<{ user: CurrentUser }>('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      onLogin(result.user)
      navigate(result.user.role === 'super_admin' ? '/accounts' : '/inbox', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Login failed.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="grid min-h-screen place-items-center bg-white px-5 py-12">
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-navy">Login</h1>

      <form className="mt-6" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" required autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="Your username" className="h-11" />
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="admin-password">Password</Label>
          <Input
            id="admin-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Enter password"
            className="h-11"
          />
        </div>

        {error && <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>}

        <Button disabled={busy} size="lg" className="mt-4 w-full">
          {busy ? 'Logging in...' : 'Login'}
        </Button>
        <p className="mt-4 text-center text-xs text-slate-500">New company? <Link to="/register" className="font-semibold text-trust hover:underline">Create an account</Link></p>
      </form>
    </div>
  </main>
}
