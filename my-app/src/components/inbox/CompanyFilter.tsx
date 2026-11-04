import { useState } from 'react'
import { Building2, Plus } from 'lucide-react'
import type { Company } from '@/types'
import AddCompanyModal from '@/components/companies/AddCompanyModal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = { companies: Company[]; selectedId: string; onSelect: (id: string) => void; onAdded: (company: Company) => void }

export default function CompanyFilter({ companies, selectedId, onSelect, onAdded }: Props) {
  const [adding, setAdding] = useState(false)

  return <>
    <div className="flex min-w-0 items-center gap-2">
      <span className="hidden items-center gap-1.5 pr-1 text-xs font-medium text-slate-400 md:inline-flex"><Building2 className="size-3.5" /> Company</span>
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-md bg-slate-100 p-1">
        <button type="button" onClick={() => onSelect('')} className={cn('h-7 shrink-0 rounded px-2.5 text-xs font-medium transition', !selectedId ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-navy')}>All</button>
        {companies.map(company => <button type="button" key={company.id} onClick={() => onSelect(company.id)} className={cn('h-7 max-w-36 shrink-0 truncate rounded px-2.5 text-xs font-medium transition', selectedId === company.id ? 'bg-white text-navy shadow-sm' : 'text-slate-500 hover:text-navy')}>{company.name}</button>)}
      </div>
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => setAdding(true)} aria-label="Add company" className="shrink-0 text-slate-500"><Plus /></Button>
    </div>
    <AddCompanyModal open={adding} onClose={() => setAdding(false)} onAdded={company => { onAdded(company); onSelect(company.id) }} />
  </>
}
