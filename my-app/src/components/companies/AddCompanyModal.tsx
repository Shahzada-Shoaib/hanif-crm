import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { api } from '@/services/api'
import type { Company } from '@/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Props = { open: boolean; onClose: () => void; onAdded: (company: Company) => void }

export default function AddCompanyModal({ open, onClose, onAdded }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api<{ company: Company }>('/api/companies', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }),
      })
      onAdded(result.company)
      setName('')
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add company.')
    } finally {
      setBusy(false)
    }
  }

  return <Dialog open={open} onOpenChange={next => { if (!next) onClose() }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <span className="mb-2 grid size-10 place-items-center rounded-lg bg-blue-50 text-trust"><Building2 className="size-5" /></span>
        <DialogTitle>Add a company</DialogTitle>
        <DialogDescription>Create an ownership group for connected WhatsApp numbers.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit}>
        <div className="space-y-2 py-2"><Label htmlFor="company-name">Company name</Label><Input id="company-name" autoFocus required minLength={2} maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Hanif Traders" className="h-10" /></div>
        {error && <Alert variant="destructive" className="mt-3"><AlertDescription>{error}</AlertDescription></Alert>}
        <DialogFooter className="mt-6"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy}>{busy ? 'Adding…' : 'Add company'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
