import { MessageSquareText } from 'lucide-react'
import NumberInbox from '@/components/inbox/NumberInbox'
import type { Bootstrap } from '@/types'

type Props = { data: Bootstrap; phoneNumberId: string }

export default function InboxPage({ data, phoneNumberId }: Props) {
  const connection = data.connections.find(item => item.phoneNumberId === phoneNumberId)

  return <div className="mx-auto flex h-[calc(100dvh-4rem)] min-h-0 w-full flex-col overflow-hidden px-3 pb-3 lg:px-7 lg:pb-5">
    <section className="flex min-h-0 flex-1 overflow-hidden rounded-b-lg border-x border-b border-slate-200 bg-white shadow-[0_8px_30px_rgb(23_43_77/0.06)]">
      {connection
        ? <NumberInbox key={connection.phoneNumberId} connection={connection} />
        : <div className="flex min-h-0 flex-1 items-center justify-center p-10 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-xl bg-slate-100 text-slate-400"><MessageSquareText className="size-5" /></span><p className="mt-3 text-sm font-semibold text-navy">No WhatsApp number available</p><p className="mt-1 text-xs text-slate-500">Choose another company or connect a number in WhatsApp setup.</p></div></div>}
    </section>
  </div>
}
