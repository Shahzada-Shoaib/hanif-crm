import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { api } from '@/services/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Brand } from '@/components/layout/Brand'
import type { CurrentUser } from '@/types'

export default function LoginPage({ onLogin }: { onLogin: (user: CurrentUser) => void }) {
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

  return <main className="relative grid h-[100svh] overflow-hidden bg-navy bg-cover bg-center px-5 py-6 before:absolute before:inset-0 before:bg-navy/60" style={{ backgroundImage: "url('/images/login-background.png')" }}>
    <section className="relative z-10 m-auto w-full max-w-[400px]">
      <div className="mb-7 flex justify-center"><Brand dark /></div>

      <div className="rounded-xl border border-white/50 bg-white/95 p-6 shadow-[0_20px_55px_rgb(5_16_35/0.28)] backdrop-blur-sm sm:p-7">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-navy">Sign in</h1>
          <p className="mt-1.5 text-sm text-slate-500">Continue to your workspace.</p>
        </div>

        <form onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="username" className="text-xs font-medium text-slate-700">Username</Label>
            <Input id="username" required autoFocus autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="Your username" className="h-11 border-slate-300 bg-white" />
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor="admin-password" className="text-xs font-medium text-slate-700">Password</Label>
            <div className="relative">
              <Input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="h-11 border-slate-300 bg-white pr-11"
              />
              <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust/40" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && <Alert variant="destructive" className="mt-4 py-2.5">
            <AlertDescription>{error}</AlertDescription>
          </Alert>}

          <Button type="submit" disabled={busy} size="lg" className="mt-5 h-11 w-full">
            {busy ? 'Signing in...' : 'Sign in'}
          </Button>

          <p className="mt-5 text-center text-xs text-slate-500">New company? <Link to="/register" className="font-semibold text-trust underline-offset-4 hover:underline">Create an account</Link></p>
        </form>
      </div>

      <p className="mt-5 text-center text-[11px] text-white/60"><Link to="/privacy" className="transition-colors hover:text-white">Privacy policy</Link></p>
    </section>
  </main>
}
