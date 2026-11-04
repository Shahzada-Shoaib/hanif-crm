import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function BrandMark({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('relative grid size-9 shrink-0 place-items-center rounded-lg bg-white text-navy shadow-sm', className)}>
    <span className="absolute left-2 top-2 size-2.5 rounded-sm bg-trust" />
    <span className="absolute bottom-2 right-2 size-2.5 rounded-sm bg-teal" />
    <span className="h-px w-4 -rotate-45 bg-navy/35" />
  </span>
}

export function Brand({ compact = false, dark = false }: { compact?: boolean; dark?: boolean }) {
  return <Link to="/" className="inline-flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
    <BrandMark />
    {!compact && <span className="min-w-0">
      <span className={cn('block text-[15px] font-semibold leading-none tracking-[-0.02em]', dark ? 'text-white' : 'text-navy')}>Hanif CRM</span>
      <span className={cn('mt-1 block text-[10px] font-medium uppercase tracking-[0.16em]', dark ? 'text-blue-200/65' : 'text-slate-500')}>Conversations, aligned</span>
    </span>}
  </Link>
}
