import { useState, type ReactNode } from 'react'
import { Building2, ChevronDown, GripVertical, Layers3, Phone, Plus } from 'lucide-react'
import type { Company, Connection } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type Props = { companies: Company[]; connections: Connection[]; onAssign: (phoneNumberId: string, companyId: string) => Promise<void>; onAdd: () => void }

export default function CompanyAssignmentBoard({ companies, connections, onAssign, onAdd }: Props) {
  const [dragging, setDragging] = useState('')
  const [over, setOver] = useState<string | null>(null)

  function drop(companyId: string) {
    if (dragging) void onAssign(dragging, companyId)
    setDragging('')
    setOver(null)
  }

  return <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.03)]">
    <div className="grid gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-500"><Layers3 className="size-4" /></span><div><h2 className="text-sm font-semibold text-navy">Number ownership</h2><p className="mt-0.5 text-xs text-slate-500">Drag a number between rows, or use its assignment menu.</p></div></div>
      <div className="flex items-center gap-4 text-xs"><Metric value={connections.length} label="connected" /><Metric value={companies.length} label="companies" /><Button type="button" onClick={onAdd}><Plus /> Add company</Button></div>
    </div>

    <div>
      {companies.map(company => {
        const numbers = connections.filter(number => number.companyId === company.id)
        return <section key={company.id} onDragOver={event => { event.preventDefault(); setOver(company.id) }} onDragLeave={() => setOver(null)} onDrop={() => drop(company.id)} className={cn('grid min-h-28 gap-3 border-b border-slate-100 px-4 py-4 transition-colors last:border-b-0 md:grid-cols-[220px_1fr]', over === company.id && 'bg-blue-50/70')}>
          <RowHeading title={company.name} description={`${numbers.length} assigned number${numbers.length === 1 ? '' : 's'}`} count={numbers.length} initials={initials(company.name)} />
          <NumberArea empty="Drop numbers here to assign them." active={over === company.id}>{numbers.map(number => <NumberChip key={number.phoneNumberId} number={number} companies={companies} onDrag={setDragging} onAssign={onAssign} />)}</NumberArea>
        </section>
      })}
      {!companies.length && <div className="grid min-h-44 place-items-center px-6 text-center"><div><span className="mx-auto grid size-10 place-items-center rounded-lg bg-slate-100 text-slate-400"><Building2 className="size-5" /></span><p className="mt-3 text-sm font-semibold text-navy">No companies yet</p><p className="mt-1 text-xs text-slate-500">Create a company to start assigning connected numbers.</p></div></div>}
    </div>
  </div>
}

function RowHeading({ icon: Icon, title, description, count, initials: letters, warning }: { icon?: typeof Phone; title: string; description: string; count: number; initials?: string; warning?: boolean }) {
  return <div className="flex items-start gap-3">
    <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg border text-xs font-semibold', warning ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-navy')}>{Icon ? <Icon className="size-4" /> : letters}</span>
    <div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-semibold text-navy">{title}</h3><span className="font-mono text-[10px] text-slate-400">{String(count).padStart(2, '0')}</span></div><p className="mt-1 text-xs text-slate-500">{description}</p></div>
  </div>
}

function NumberArea({ children, empty, active }: { children: ReactNode; empty: string; active: boolean }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children)
  return <div className={cn('flex min-h-14 flex-wrap content-start items-center gap-2 rounded-md border border-dashed border-slate-200 bg-slate-50/60 p-2.5 transition-colors', active && 'border-trust/40 bg-white')}>{hasChildren ? children : <p className="px-1 text-xs text-slate-400">{empty}</p>}</div>
}

function NumberChip({ number, companies, onDrag, onAssign }: { number: Connection; companies: Company[]; onDrag: (id: string) => void; onAssign: Props['onAssign'] }) {
  return <div draggable onDragStart={event => { event.dataTransfer.effectAllowed = 'move'; onDrag(number.phoneNumberId) }} onDragEnd={() => onDrag('')} className="group inline-flex max-w-full cursor-grab items-center rounded-md border border-slate-200 bg-white shadow-[0_1px_1px_rgb(15_23_42/0.03)] transition hover:border-blue-300 hover:shadow-sm active:cursor-grabbing">
    <span className="grid h-8 w-7 place-items-center border-r border-slate-100 text-slate-300 group-hover:text-slate-500"><GripVertical className="size-3.5" /></span>
    <span className={cn('ml-2 size-1.5 shrink-0 rounded-full', number.webhookSubscribed ? 'bg-teal' : 'bg-amber-500')} />
    <span className="max-w-36 truncate px-2 py-1.5 font-mono text-[11px] font-medium text-navy">{number.displayPhone}</span>
    <span className="relative mr-1 border-l border-slate-100 pl-1">
      <select aria-label={`Assign ${number.displayPhone}`} value={number.companyId || ''} onChange={event => void onAssign(number.phoneNumberId, event.target.value)} onClick={event => event.stopPropagation()} className="h-7 max-w-28 appearance-none rounded border-0 bg-transparent py-0 pr-5 pl-1.5 text-[10px] text-slate-500 outline-none focus:ring-1 focus:ring-trust">
        {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
      </select><ChevronDown className="pointer-events-none absolute top-1/2 right-1 size-3 -translate-y-1/2 text-slate-400" />
    </span>
  </div>
}

function Metric({ value, label, warning }: { value: number; label: string; warning?: boolean }) {
  return <span className="whitespace-nowrap"><strong className={cn('mr-1 font-mono text-xs', warning ? 'text-amber-700' : 'text-navy')}>{value}</strong><span className="text-slate-400">{label}</span></span>
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase()
}
