import { useState } from 'react'
import AddCompanyModal from '@/components/companies/AddCompanyModal'
import CompanyAssignmentBoard from '@/components/companies/CompanyAssignmentBoard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api } from '@/services/api'
import type { Bootstrap } from '@/types'

export default function CompaniesPage({ data, onChange }: { data: Bootstrap; onChange: (data: Bootstrap) => void }) {
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  async function assign(phoneNumberId: string, nextCompanyId: string) {
    const companyId = nextCompanyId
    try {
      await api('/api/companies', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumberId, companyId }) })
      onChange({ ...data, connections: data.connections.map(item => item.phoneNumberId === phoneNumberId ? { ...item, companyId } : item) })
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not assign company.')
    }
  }

  return <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
    {error && <Alert variant="destructive" className="mt-5"><AlertDescription>{error}</AlertDescription></Alert>}
    <div className="mt-5"><CompanyAssignmentBoard companies={data.companies} connections={data.connections} onAssign={assign} onAdd={() => setAdding(true)} /></div>
    <AddCompanyModal open={adding} onClose={() => setAdding(false)} onAdded={company => onChange({ ...data, companies: [...data.companies, company].sort((a, b) => a.name.localeCompare(b.name)) })} />
  </div>
}
