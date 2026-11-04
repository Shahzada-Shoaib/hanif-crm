import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LoaderCircle, MessageSquareText, Plus, Search, UserRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/services/api'
import type { ChatMessage, Connection, Conversation } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import Chat from './Chat'

type ConversationPage = { conversations: Conversation[]; nextCursor: string | null }
type MessagePage = { messages: ChatMessage[]; nextCursor: string | null }

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const messages = new Map(current.map(message => [message.id, message]))
  incoming.forEach(message => messages.set(message.id, message))
  return [...messages.values()].sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))
}

export default function NumberInbox({ connection }: { connection: Connection }) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationCursor, setConversationCursor] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageCursor, setMessageCursor] = useState<string | null>(null)
  const [selectedContact, setSelectedContact] = useState('')
  const [recipient, setRecipient] = useState('')
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [mobileChat, setMobileChat] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [bumpedContact, setBumpedContact] = useState('')
  const [refreshVersion, setRefreshVersion] = useState(0)
  const selectedContactRef = useRef('')
  const knownMessageIds = useRef(new Set<string>())
  const activeSearchRef = useRef('')
  const audioContext = useRef<AudioContext | null>(null)
  const bumpTimer = useRef<number | undefined>(undefined)

  const merge = useCallback((items: ChatMessage[]) => {
    items.forEach(message => knownMessageIds.current.add(message.id))
    setMessages(current => mergeMessages(current, items))
  }, [])

  const markRead = useCallback((conversation: Conversation) => {
    const params = new URLSearchParams({ phoneNumberId: connection.phoneNumberId, throughMessageId: conversation.lastMessage.id })
    void api(`/api/whatsapp/conversations/${conversation.contactId}/read?${params}`, { method: 'POST' })
      .then(() => setConversations(current => current.map(item => item.contactId === conversation.contactId ? { ...item, unreadCount: 0 } : item)))
      .catch(() => undefined)
  }, [connection.phoneNumberId])

  useEffect(() => {
    const normalizedQuery = query.trim()
    if (normalizedQuery === search) return
    const timer = window.setTimeout(() => {
      setLoading(true)
      setSearch(normalizedQuery)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query, search])

  const playNotificationSound = useCallback(() => {
    const context = audioContext.current
    if (!context) return
    function play() {
      if (!context || context.state !== 'running') return
      const start = context.currentTime
      const gain = context.createGain()
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28)
      gain.connect(context.destination)
      for (const [frequency, delay] of [[660, 0], [880, 0.11]] as const) {
        const tone = context.createOscillator()
        tone.type = 'sine'
        tone.frequency.setValueAtTime(frequency, start + delay)
        tone.connect(gain)
        tone.start(start + delay)
        tone.stop(start + delay + 0.16)
      }
    }
    if (context.state === 'suspended') void context.resume().then(play)
    else play()
  }, [])

  useEffect(() => {
    function unlockNotificationSound() {
      audioContext.current ??= new AudioContext()
      if (audioContext.current.state === 'suspended') void audioContext.current.resume()
    }
    window.addEventListener('pointerdown', unlockNotificationSound, { once: true })
    window.addEventListener('keydown', unlockNotificationSound, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlockNotificationSound)
      window.removeEventListener('keydown', unlockNotificationSound)
      if (bumpTimer.current) window.clearTimeout(bumpTimer.current)
      const context = audioContext.current
      audioContext.current = null
      if (context) void context.close()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    activeSearchRef.current = search
    const params = new URLSearchParams({ phoneNumberId: connection.phoneNumberId, limit: '50' })
    if (search) params.set('search', search)
    api<ConversationPage>(`/api/whatsapp/conversations?${params}`, { signal: controller.signal })
      .then(page => {
        setConversations(page.conversations)
        setConversationCursor(page.nextCursor)
        if (!selectedContactRef.current && page.conversations[0]) {
          setLoadingMessages(true)
          selectedContactRef.current = page.conversations[0].contactId
          setSelectedContact(page.conversations[0].contactId)
          markRead(page.conversations[0])
        }
      })
      .catch(cause => { if (cause.name !== 'AbortError') setError(cause instanceof Error ? cause.message : 'Could not load conversations.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [connection.phoneNumberId, markRead, search, refreshVersion])

  useEffect(() => {
    if (!selectedContact) return
    const controller = new AbortController()
    const params = new URLSearchParams({ phoneNumberId: connection.phoneNumberId, limit: '50' })
    api<MessagePage>(`/api/whatsapp/conversations/${selectedContact}/messages?${params}`, { signal: controller.signal })
      .then(page => {
        page.messages.forEach(message => knownMessageIds.current.add(message.id))
        setMessages(page.messages)
        setMessageCursor(page.nextCursor)
      })
      .catch(cause => { if (cause.name !== 'AbortError') setError(cause instanceof Error ? cause.message : 'Could not load messages.') })
      .finally(() => { if (!controller.signal.aborted) setLoadingMessages(false) })
    return () => controller.abort()
  }, [connection.phoneNumberId, selectedContact, refreshVersion])

  const applyLiveMessage = useCallback((message: ChatMessage, notify: boolean) => {
    const contactId = message.direction === 'in' ? message.from : message.to
    const isActive = selectedContact === contactId
    if (isActive) merge([message])
    if (isActive && message.direction === 'in') {
      const params = new URLSearchParams({ phoneNumberId: connection.phoneNumberId, throughMessageId: message.id })
      void api(`/api/whatsapp/conversations/${contactId}/read?${params}`, { method: 'POST' }).catch(() => undefined)
    }
    setConversations(current => {
      const existing = current.find(item => item.contactId === contactId)
      if (search && !existing) return current
      const next: Conversation = {
        contactId,
        contactName: existing?.contactName || '',
        lastMessage: message,
        unreadCount: isActive ? 0 : (existing?.unreadCount || 0) + (message.direction === 'in' ? 1 : 0),
        status: existing?.status || 'open',
        assignedUserId: existing?.assignedUserId || null,
      }
      return [next, ...current.filter(item => item.contactId !== contactId)]
    })
    if (notify && message.direction === 'in') {
      setBumpedContact(contactId)
      playNotificationSound()
      if (bumpTimer.current) window.clearTimeout(bumpTimer.current)
      bumpTimer.current = window.setTimeout(() => setBumpedContact(''), 900)
    }
  }, [connection.phoneNumberId, merge, playNotificationSound, search, selectedContact])

  useEffect(() => {
    const stream = new EventSource(`/api/whatsapp/stream?phoneNumberId=${encodeURIComponent(connection.phoneNumberId)}`)
    stream.addEventListener('message', event => {
      try {
        const message = JSON.parse((event as MessageEvent).data) as ChatMessage
        const isNew = !knownMessageIds.current.has(message.id)
        knownMessageIds.current.add(message.id)
        applyLiveMessage(message, isNew)
      } catch { /* ignore malformed stream data */ }
    })
    stream.addEventListener('message_status', event => {
      try {
        const update = JSON.parse((event as MessageEvent).data) as { id: string; status: string; error?: string }
        setMessages(current => current.map(message => message.id === update.id ? { ...message, status: update.status, error: update.error } : message))
        if (update.status === 'failed') toast.error('Message not sent', { description: update.error || 'WhatsApp could not deliver this message.' })
      } catch { /* ignore malformed stream data */ }
    })
    stream.addEventListener('message_revision', event => {
      try {
        const update = JSON.parse((event as MessageEvent).data) as Pick<ChatMessage, 'id' | 'editedText' | 'editedAt' | 'deletedAt'>
        setMessages(current => current.map(message => message.id === update.id ? { ...message, ...update } : message))
        setConversations(current => current.map(conversation => conversation.lastMessage.id === update.id ? {
          ...conversation,
          lastMessage: {
            ...conversation.lastMessage,
            text: update.deletedAt ? 'This message was deleted from WhatsApp' : update.editedText || conversation.lastMessage.text,
          },
        } : conversation))
      } catch { /* ignore malformed stream data */ }
    })
    stream.addEventListener('message_reaction', event => {
      try {
        const update = JSON.parse((event as MessageEvent).data) as Pick<ChatMessage, 'id' | 'reactionEmoji' | 'reactionAt'>
        setMessages(current => current.map(message => message.id === update.id ? { ...message, ...update } : message))
      } catch { /* ignore malformed stream data */ }
    })
    stream.addEventListener('refresh', () => setRefreshVersion(value => value + 1))
    return () => stream.close()
  }, [applyLiveMessage, connection.phoneNumberId])

  async function loadMoreConversations() {
    if (!conversationCursor || loadingMoreConversations) return
    setLoadingMoreConversations(true)
    const requestedSearch = search
    try {
      const params = new URLSearchParams({ phoneNumberId: connection.phoneNumberId, limit: '50', cursor: conversationCursor })
      if (search) params.set('search', search)
      const page = await api<ConversationPage>(`/api/whatsapp/conversations?${params}`)
      if (activeSearchRef.current !== requestedSearch) return
      setConversations(current => {
        const existing = new Set(current.map(item => item.contactId))
        return [...current, ...page.conversations.filter(item => !existing.has(item.contactId))]
      })
      setConversationCursor(page.nextCursor)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load more conversations.')
    } finally {
      setLoadingMoreConversations(false)
    }
  }

  async function loadOlderMessages() {
    if (!selectedContact || !messageCursor || loadingOlderMessages) return
    setLoadingOlderMessages(true)
    try {
      const params = new URLSearchParams({ phoneNumberId: connection.phoneNumberId, limit: '50', cursor: messageCursor })
      const page = await api<MessagePage>(`/api/whatsapp/conversations/${selectedContact}/messages?${params}`)
      setMessages(current => mergeMessages(current, page.messages))
      setMessageCursor(page.nextCursor)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load older messages.')
    } finally {
      setLoadingOlderMessages(false)
    }
  }

  function openContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const number = recipient.replace(/\D/g, '')
    if (!/^[1-9]\d{6,14}$/.test(number)) { setError('Enter a customer number with country code.'); return }
    setMessages([])
    setMessageCursor(null)
    setLoadingMessages(true)
    selectedContactRef.current = number
    setSelectedContact(number)
    setRecipient('')
    setComposerOpen(false)
    setMobileChat(true)
    setError('')
  }

  function selectContact(contact: string) {
    if (contact !== selectedContact) {
      setMessages([])
      setMessageCursor(null)
      setLoadingMessages(true)
    }
    selectedContactRef.current = contact
    setSelectedContact(contact)
    setMobileChat(true)
    const conversation = conversations.find(item => item.contactId === contact)
    if (conversation) markRead(conversation)
  }

  const activeConversation = useMemo(() => conversations.find(item => item.contactId === selectedContact), [conversations, selectedContact])

  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
    {error && <div role="alert" className="border-b border-red-100 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">{error}</div>}
    <div className="grid min-h-0 flex-1 md:grid-cols-[300px_minmax(0,1fr)]">
      <aside className={cn('min-h-0 flex-col overflow-hidden border-r border-slate-200 bg-white', mobileChat ? 'hidden md:flex' : 'flex')}>
        <div className="shrink-0 border-b border-slate-100 p-3">
          {composerOpen ? <form className="flex gap-1.5" onSubmit={openContact}><Input aria-label="Customer number with country code" autoFocus placeholder="Country code + number" value={recipient} onChange={event => setRecipient(event.target.value)} className="h-8 font-mono text-xs" /><Button size="sm">Open</Button><Button type="button" variant="ghost" size="icon-sm" onClick={() => setComposerOpen(false)} aria-label="Cancel new conversation"><X /></Button></form> : <div className="flex gap-2"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" /><Input aria-label="Search all conversations" placeholder="Search all conversations" value={query} onChange={event => setQuery(event.target.value)} className="h-8 bg-slate-50 pl-8 text-xs" /></div><Button type="button" size="icon-sm" onClick={() => setComposerOpen(true)} aria-label="Open a new conversation"><Plus /></Button></div>}
        </div>
        <div className="crm-scrollbar min-h-0 flex-1 overflow-y-auto p-2" onScroll={event => { const target = event.currentTarget; if (target.scrollHeight - target.scrollTop - target.clientHeight < 240) void loadMoreConversations() }}>
          {loading && !conversations.length && <div className="space-y-2 p-1">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="flex gap-3 p-2"><Skeleton className="size-9 rounded-lg" /><div className="flex-1"><Skeleton className="h-3 w-24" /><Skeleton className="mt-2 h-2.5 w-full" /></div></div>)}</div>}
          {!loading && !conversations.length && <div className="grid min-h-72 place-items-center px-5 text-center"><div><span className="mx-auto grid size-10 place-items-center rounded-lg bg-slate-100 text-slate-400"><MessageSquareText className="size-5" /></span><p className="mt-3 text-sm font-semibold text-navy">{search ? 'No matching conversations' : 'Your inbox is ready'}</p><p className="mt-1 text-xs leading-5 text-slate-500">{search ? 'The complete conversation history was searched.' : 'Incoming customer messages will appear here.'}</p></div></div>}
          <div className="space-y-0.5">{conversations.map(conversation => {
            const { contactId: contact, lastMessage: last } = conversation
            const name = conversation.contactName || contact
            const selected = selectedContact === contact
            return <button type="button" key={contact} onClick={() => selectContact(contact)} className={cn('group flex w-full gap-3 rounded-md border-l-2 px-2.5 py-2.5 text-left transition-colors', selected ? 'border-trust bg-blue-50/75' : 'border-transparent hover:bg-slate-50', bumpedContact === contact && 'bg-blue-50')}>
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg text-xs font-semibold', selected ? 'bg-trust text-white' : 'bg-slate-100 text-slate-500')}>{initials(name)}</span>
              <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className={cn('truncate text-xs font-semibold', conversation.unreadCount ? 'text-navy' : 'text-slate-700')}>{name}</span><time className="shrink-0 font-mono text-[8px] text-slate-400">{formatListTime(last.timestamp)}</time></span><span className="mt-1 flex items-center gap-2"><span className={cn('block flex-1 truncate text-[11px]', conversation.unreadCount ? 'font-medium text-slate-600' : 'text-slate-400')}>{last.direction === 'out' ? 'You: ' : ''}{last.text}</span>{conversation.unreadCount > 0 && <span className="grid min-w-4 place-items-center rounded-full bg-trust px-1 text-[8px] font-semibold leading-4 text-white">{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span>}</span></span>
            </button>
          })}</div>
          {loadingMoreConversations && <div className="flex items-center justify-center gap-2 py-4 text-[10px] text-slate-400"><LoaderCircle className="size-3.5 animate-spin" />Loading older conversations</div>}
        </div>
      </aside>

      <div className={cn('min-h-0 min-w-0', mobileChat ? 'flex' : 'hidden md:flex')}>
        {selectedContact ? <Chat connection={connection} contact={selectedContact} contactName={activeConversation?.contactName} messages={messages} loading={loadingMessages} hasOlder={Boolean(messageCursor)} loadingOlder={loadingOlderMessages} onLoadOlder={loadOlderMessages} onSent={message => applyLiveMessage(message, false)} onBack={() => setMobileChat(false)} /> : <div className="grid min-h-0 flex-1 place-items-center bg-[#f7f9fc] p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm"><UserRound className="size-5" /></span><p className="mt-3 text-sm font-semibold text-navy">Choose a conversation</p><p className="mt-1 text-xs text-slate-500">Select a customer thread or open a new number.</p></div></div>}
      </div>
    </div>
  </div>
}

function initials(value: string) {
  return value.replace('+', '').split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'WA'
}

function formatListTime(timestamp: number) {
  const date = new Date(timestamp)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}
