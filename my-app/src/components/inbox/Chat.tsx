import { useLayoutEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, CheckCheck, Download, FileText, LoaderCircle, MessageSquareOff, MessageSquareText, PencilLine, SendHorizontal } from 'lucide-react'
import { api } from '@/services/api'
import type { ChatMessage, Connection } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Props = {
  connection: Connection
  contact: string
  contactName?: string
  messages: ChatMessage[]
  loading?: boolean
  hasOlder?: boolean
  loadingOlder?: boolean
  onLoadOlder?: () => Promise<void>
  onSent: (message: ChatMessage) => void
  onBack?: () => void
}

export default function Chat({ connection, contact, contactName, messages, loading, hasOlder, loadingOlder, onLoadOlder, onSent, onBack }: Props) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const messageViewport = useRef<HTMLDivElement>(null)
  const previousContact = useRef<string | null>(null)
  const loadingOlderRef = useRef(false)

  const latestMessageId = messages.at(-1)?.id
  useLayoutEffect(() => {
    const viewport = messageViewport.current
    if (!viewport || loading) return
    const changedConversation = previousContact.current !== contact
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (changedConversation) {
      viewport.scrollTop = viewport.scrollHeight
    } else {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: reduceMotion ? 'auto' : 'smooth',
      })
    }
    previousContact.current = contact
  }, [contact, latestMessageId, loading])

  async function loadOlder() {
    const viewport = messageViewport.current
    if (!viewport || !onLoadOlder || !hasOlder || loadingOlderRef.current) return
    loadingOlderRef.current = true
    const previousHeight = viewport.scrollHeight
    const previousTop = viewport.scrollTop
    try {
      await onLoadOlder()
      requestAnimationFrame(() => {
        viewport.scrollTop = previousTop + viewport.scrollHeight - previousHeight
      })
    } finally {
      loadingOlderRef.current = false
    }
  }

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setError('')
    try {
      const result = await api<{ message: ChatMessage }>('/api/whatsapp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumberId: connection.phoneNumberId, to: contact, text }) })
      onSent(result.message)
      setDraft('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send message.')
    } finally {
      setSending(false)
    }
  }

  const displayName = contactName || contact

  return <div className="flex min-h-0 flex-1 overflow-hidden">
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 px-4">
        {onBack && <Button type="button" variant="ghost" size="icon-sm" onClick={onBack} className="md:hidden" aria-label="Back to conversations"><ArrowLeft /></Button>}
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-navy text-xs font-semibold text-white">{initials(displayName)}</span>
        <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-navy">{displayName}</h3><p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">+{contact}</p></div>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-400"><span className="size-1.5 rounded-full bg-teal" /><span className="hidden sm:inline">WhatsApp conversation</span></div>
      </header>

      <div ref={messageViewport} onScroll={event => { if (event.currentTarget.scrollTop < 120) void loadOlder() }} className="crm-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[#f7f9fc] px-4 py-5 sm:px-6">
        <div className="mx-auto mb-2 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400"><span className="h-px w-6 bg-slate-200" /> Conversation history <span className="h-px w-6 bg-slate-200" /></div>
        {(loading || loadingOlder) && <div className="flex items-center justify-center gap-2 py-2 text-[10px] text-slate-400"><LoaderCircle className="size-3.5 animate-spin" />{loading ? 'Loading latest messages' : 'Loading older messages'}</div>}
        {!loading && !messages.length && <div className="m-auto max-w-xs text-center"><span className="mx-auto grid size-11 place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm"><MessageSquareText className="size-5" /></span><p className="mt-3 text-sm font-semibold text-navy">Start the conversation</p><p className="mt-1 text-xs leading-5 text-slate-500">Send a clear first message from {connection.displayPhone}.</p></div>}
        {messages.map(message => <div key={message.id} className={`flex ${message.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-[86%] sm:max-w-[72%] ${message.direction === 'out' ? 'text-right' : ''}`}>
            <div className={`inline-block overflow-hidden whitespace-pre-wrap break-words text-left text-sm leading-6 shadow-[0_1px_2px_rgb(15_23_42/0.05)] ${message.media ? 'p-1.5' : 'px-3.5 py-2.5'} ${message.direction === 'out' ? 'rounded-xl rounded-br-[3px] bg-navy text-white' : 'rounded-xl rounded-bl-[3px] border border-slate-200 bg-white text-slate-700'}`}>
              <MessageContent message={message} />
              {message.editedText && <div className={`mt-1 border-t pt-1 text-[13px] leading-5 ${message.direction === 'out' ? 'border-white/15 text-cyan-200' : 'border-teal/20 text-teal-700'}`}><span>{message.editedText}</span><span className={`ml-1.5 inline-flex items-center gap-0.5 rounded px-1 py-px align-middle text-[8px] font-medium leading-3 ${message.direction === 'out' ? 'bg-white/10 text-white/60' : 'bg-teal/10 text-teal-600'}`}><PencilLine className="size-2" /> edited</span></div>}
              {message.deletedAt && <div className={`mt-1 flex items-center gap-1 border-t pt-1 text-[9px] leading-4 italic ${message.direction === 'out' ? 'border-white/15 text-white/50' : 'border-slate-100 text-slate-400'}`}><MessageSquareOff className="size-2.5 shrink-0" /> This message was deleted from WhatsApp.</div>}
            </div>
            {message.reactionEmoji && <div className={`-mt-1 flex ${message.direction === 'out' ? 'justify-end pr-2' : 'justify-start pl-2'}`}><span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-sm leading-none shadow-sm">{message.reactionEmoji}</span></div>}
            <time className={`mt-1 flex items-center justify-end gap-1 font-mono text-[9px] ${message.status === 'failed' ? 'text-red-500' : 'text-slate-400'}`}>{formatMessageTime(message.timestamp)}{message.direction === 'out' && (message.status === 'failed' ? <AlertCircle className="size-3" /> : <CheckCheck className="size-3 text-teal" />)}</time>
          </div>
        </div>)}
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white p-3.5">
        {error && <p role="alert" className="mb-2.5 text-xs font-medium text-red-600">{error}</p>}
        <form className="flex items-center gap-2" onSubmit={send}>
          <Input aria-label="Reply" value={draft} onChange={event => setDraft(event.target.value)} disabled={sending} maxLength={4096} placeholder="Write a reply…" className="h-10 flex-1 border-slate-200 bg-slate-50/70 focus-visible:bg-white" />
          <Button disabled={sending || !draft.trim()} size="icon" aria-label="Send message" className="size-10 shrink-0"><SendHorizontal /></Button>
        </form>
        <div className="mt-2 flex justify-between px-1 text-[9px] text-slate-400"><span>Sent via WhatsApp Cloud API</span><span>{draft.length}/4096</span></div>
      </div>
    </section>

  </div>
}

function MessageContent({ message }: { message: ChatMessage }) {
  if (!message.media) return message.text

  const url = `/api/whatsapp/media/${encodeURIComponent(message.phoneNumberId)}/${encodeURIComponent(message.media.id)}`
  const type = message.type || 'document'
  const caption = message.media.caption

  return <>
    {(type === 'image' || type === 'sticker') && <img src={url} alt={caption || message.media.filename || 'WhatsApp image'} loading="lazy" className={`${type === 'sticker' ? 'max-h-44 max-w-44 object-contain' : 'max-h-80 w-auto max-w-full rounded-lg object-contain'} bg-white/5`} />}
    {type === 'video' && <video src={url} controls preload="metadata" className="max-h-80 max-w-full rounded-lg bg-black" />}
    {type === 'audio' && <audio src={url} controls preload="metadata" className="max-w-full" />}
    {type === 'document' && <a href={url} target="_blank" rel="noreferrer" className={`flex min-w-56 items-center gap-3 rounded-lg px-3 py-2.5 ${message.direction === 'out' ? 'bg-white/10 hover:bg-white/15' : 'bg-slate-50 hover:bg-slate-100'}`}>
      <span className={`grid size-9 shrink-0 place-items-center rounded-md ${message.direction === 'out' ? 'bg-white/10' : 'bg-white text-slate-500 shadow-sm'}`}><FileText className="size-4" /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{message.media.filename || 'WhatsApp document'}</span><span className={`block truncate text-[10px] ${message.direction === 'out' ? 'text-white/60' : 'text-slate-400'}`}>{message.media.mimeType}</span></span>
      <Download className="size-4 shrink-0 opacity-70" />
    </a>}
    {!['image', 'sticker', 'video', 'audio', 'document'].includes(type) && <a href={url} target="_blank" rel="noreferrer" className="underline">Open media</a>}
    {caption && <p className="px-2 pb-1 pt-1.5">{caption}</p>}
  </>
}

function initials(value: string) {
  return value.replace('+', '').split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'WA'
}

function formatMessageTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

