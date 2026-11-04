import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

export default function PageHeader({ eyebrow, title, description, actions, className }: Props) {
  return <header className={cn('flex flex-col gap-4 border-b border-border/90 pb-5 sm:flex-row sm:items-end sm:justify-between', className)}>
    <div className="min-w-0">
      {eyebrow && <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-trust">{eyebrow}</p>}
      <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.035em] text-navy sm:text-[30px]">{title}</h1>
      {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </header>
}
