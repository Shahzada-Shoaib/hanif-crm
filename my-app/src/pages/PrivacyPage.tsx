import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PrivacyPage() {
  return <div className="flex-1 bg-[#f8fafc]">
    <div className="mx-auto grid max-w-6xl px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[240px_1fr] lg:gap-16 lg:py-20">
      <aside className="mb-10 lg:mb-0"><div className="sticky top-8"><span className="grid size-10 place-items-center rounded-lg bg-blue-50 text-trust"><ShieldCheck className="size-5" /></span><p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-trust">Trust center</p><p className="mt-2 text-sm leading-6 text-slate-500">How Hanif CRM handles connected WhatsApp business data.</p><Button variant="ghost" size="sm" asChild className="mt-5 -ml-2 text-slate-600"><Link to="/"><ArrowLeft /> Back to home</Link></Button></div></aside>
      <article className="max-w-2xl">
        <header className="border-b border-slate-200 pb-8"><p className="font-mono text-xs text-slate-400">UPDATED / SEP 2026</p><h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-navy">Privacy policy</h1><p className="mt-4 text-base leading-7 text-slate-500">A plain-language summary of the data required to operate your WhatsApp CRM workspace.</p></header>
        <div className="space-y-9 py-9 text-sm leading-7 text-slate-600">
          <PolicySection number="01" title="Service scope">Hanif CRM helps businesses connect WhatsApp Business accounts and manage customer conversations.</PolicySection>
          <PolicySection number="02" title="Connected account data">When you connect WhatsApp, we receive access tokens and WhatsApp Business identifiers needed to send and receive messages on your behalf through Meta’s WhatsApp Cloud API.</PolicySection>
          <PolicySection number="03" title="Message processing">Message content is processed only to display conversations in your CRM inbox and to send replies you initiate. We do not sell your data or use WhatsApp data for advertising.</PolicySection>
          <PolicySection number="04" title="Authentication">Authentication uses Facebook Login for Business and WhatsApp Embedded Signup provided by Meta.</PolicySection>
          <PolicySection number="05" title="Questions">For questions about this policy, contact the app administrator through the support information listed with your Meta application.</PolicySection>
        </div>
      </article>
    </div>
  </div>
}

function PolicySection({ number, title, children }: { number: string; title: string; children: string }) {
  return <section className="grid grid-cols-[36px_1fr] gap-4"><span className="pt-0.5 font-mono text-[10px] text-slate-300">{number}</span><div><h2 className="font-semibold text-navy">{title}</h2><p className="mt-2">{children}</p></div></section>
}
