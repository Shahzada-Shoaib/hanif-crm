"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage, Connection } from "@/lib/types";
import HostedOnboarding from "./HostedOnboarding";
import HistorySync from "./HistorySync";

async function api(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  // Reload the protected server page to discard cached private data after session expiry.
  if (response.status === 401) { window.location.reload(); throw new Error("Please sign in again."); }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
const button = "rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50";

export default function Inbox({ initialConnections }: { initialConnections: Connection[] }) {
  const router = useRouter();
  const [connections, setConnections] = useState(initialConnections);
  const [selected, setSelected] = useState(initialConnections[0]?.phoneNumberId || "");
  const [manage, setManage] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const connection = connections.find((item) => item.phoneNumberId === selected);
  const updateConnections = useCallback((items: Connection[]) => {
    setConnections(items);
    setSelected(current => items.some(item => item.phoneNumberId === current) ? current : items[0]?.phoneNumberId || "");
  }, []);

  const importOrSync = async (body: object) => {
    setBusy(true); setError(""); setInfo("");
    try {
      const result = await api("/api/whatsapp/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setAccessToken("");
      setInfo(result.warning || "Account saved. Select a number to open its chats.");
      updateConnections(result.connections);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save connection."); }
    finally { setBusy(false); }
  };

  const clearDatabase = async () => {
    if (!window.confirm("Clear all local CRM data? This permanently removes linked numbers, saved tokens, chats, contacts and sync history. Numbers remain connected on Meta. This cannot be undone.")) return;
    setBusy(true); setError("");
    try {
      await api("/api/database", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "CLEAR DATABASE" }) });
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not clear database.");
      setBusy(false);
    }
  };

  return <div className="mx-auto max-w-7xl p-4 sm:p-6">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">WhatsApp inbox</h1><p className="text-sm text-gray-500">Choose a business number to view its conversations.</p></div>
      <div className="flex gap-3">
        <button disabled={busy} className="text-sm underline disabled:opacity-50" onClick={() => window.location.reload()}>Refresh inbox</button>
        <button className={button} onClick={() => setManage(!manage)}>{manage ? "Close settings" : "Advanced settings"}</button>
        <button className="text-sm underline" onClick={async () => {
          try { await api("/api/session", { method: "DELETE" }); router.replace("/login"); router.refresh(); }
          catch { setError("Could not sign out. Please try again."); }
        }}>Sign out</button>
      </div>
    </div>
    {info && <p role="status" className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{info}</p>}
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <HostedOnboarding onConnections={updateConnections} />
    {manage && <section className="mb-6 rounded-xl border border-gray-200 p-5">
      <div>
        <h2 className="mb-2 font-semibold">Import existing numbers</h2>
        <p className="mb-3 text-sm text-gray-600">Already registered in Meta? Import the account here. All numbers accessible in that account will be saved. Re-import to replace an expired token.</p>
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void importOrSync({ wabaId, accessToken }); }}>
          <label className="block text-sm">WhatsApp Business Account ID (WABA ID)
            <input required pattern="[0-9]+" inputMode="numeric" value={wabaId} onChange={(event) => setWabaId(event.target.value)} className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <label className="block text-sm">Access token
            <input required type="password" autoComplete="off" value={accessToken} onChange={(event) => setAccessToken(event.target.value)} className="mt-1 w-full rounded-lg border p-2" />
          </label>
          <p className="text-xs text-gray-500">Import also subscribes this app to the account&apos;s webhooks. The token is stored encrypted and is never returned in the numbers list.</p>
          <button disabled={busy} className={button}>{busy ? "Saving…" : "Import account"}</button>
        </form>
      </div>
    </section>}
    <div className="grid min-h-[65vh] overflow-hidden rounded-xl border border-gray-200 lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-gray-200 bg-gray-50 p-3 lg:border-r lg:border-b-0">
        <h2 className="mb-3 px-2 text-sm font-semibold">Linked numbers ({connections.length})</h2>
        <button type="button" disabled={busy} onClick={() => void clearDatabase()} className="mb-2 w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">Clear database</button>
        <p className="mb-4 px-2 text-xs text-gray-500">Removes all local linked numbers and chats. Requires confirmation.</p>
        {!connections.length && <p className="p-2 text-sm text-gray-600">Use Open Meta onboarding above to connect your WhatsApp Business app.</p>}
        <div className="space-y-2">{connections.map((item) => <button key={item.phoneNumberId} onClick={() => setSelected(item.phoneNumberId)} aria-pressed={selected === item.phoneNumberId}
          className={`w-full rounded-lg border p-3 text-left ${selected === item.phoneNumberId ? "border-green-600 bg-green-50" : "border-gray-200 bg-white"}`}>
          <span className="block text-sm font-semibold">{item.displayPhone}</span>
          <span className="block text-xs text-gray-600">{item.verifiedName}</span>
          <span className={`mt-2 block text-xs ${item.webhookSubscribed ? "text-green-700" : "text-amber-700"}`}>{item.webhookSubscribed ? "Webhook subscribed" : "Webhook needs attention"}</span>
        </button>)}</div>
      </aside>
      {connection ? <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
          <div><p className="font-semibold">{connection.displayPhone}</p><p className="text-xs text-gray-500">{connection.verifiedName}</p></div>
          {manage && <button disabled={busy} onClick={() => void importOrSync({ action: "sync", phoneNumberId: connection.phoneNumberId })} className="text-sm text-green-800 underline disabled:opacity-50">{busy ? "Syncing…" : "Sync account numbers"}</button>}
        </div>
        <HistorySync key={`history-${connection.phoneNumberId}`} phoneNumberId={connection.phoneNumberId} />
        <NumberInbox key={connection.phoneNumberId} connection={connection} />
      </div> : <div className="flex items-center justify-center p-10 text-sm text-gray-500">Select a linked WhatsApp number.</div>}
    </div>
  </div>;
}

function NumberInbox({ connection }: { connection: Connection }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contactNames, setContactNames] = useState<Record<string, string>>({});
  const [selectedContact, setSelectedContact] = useState("");
  const [recipient, setRecipient] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const phoneNumberId = connection.phoneNumberId;
  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    const load = async () => {
      try {
        if (!document.hidden) {
          const data = await api(`/api/whatsapp/messages?phoneNumberId=${encodeURIComponent(phoneNumberId)}`, { signal: controller.signal });
          if (!stopped) {
            setContactNames(data.contacts || {});
            setMessages((current) => {
              const merged = new Map(current.map((message) => [message.id, message]));
              for (const message of data.messages as ChatMessage[]) merged.set(message.id, message);
              return [...merged.values()].sort((a, b) => a.timestamp - b.timestamp);
            });
            setError("");
          }
        }
      } catch (error) { if (!stopped) setError(error instanceof Error ? error.message : "Could not load chats."); }
      finally { if (!stopped) setLoading(false); }
    };
    void load();
    return () => { stopped = true; controller.abort(); };
  }, [phoneNumberId]);

  const conversations = useMemo(() => {
    const contacts = new Map<string, ChatMessage>();
    for (const message of messages) {
      const contact = message.direction === "in" ? message.from : message.to;
      const previous = contacts.get(contact);
      if (!previous || message.timestamp >= previous.timestamp) contacts.set(contact, message);
    }
    return [...contacts.entries()].sort((a, b) => b[1].timestamp - a[1].timestamp);
  }, [messages]);
  const active = selectedContact || conversations[0]?.[0] || "";
  const onSent = useCallback((message: ChatMessage) => setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]), []);

  return <div>
    {error && <p role="alert" className="p-3 text-sm text-red-700">{error}</p>}
    <div className="grid min-h-[55vh] md:grid-cols-[220px_1fr]">
      <aside className="border-b border-gray-200 p-3 md:border-r md:border-b-0">
        <h3 className="mb-3 text-sm font-semibold">Customer chats</h3>
        <form className="mb-4 flex gap-1" onSubmit={(event) => {
          event.preventDefault(); const number = recipient.replace(/\D/g, "");
          if (!/^\d{7,15}$/.test(number)) { setError("Enter a customer number with country code."); return; }
          setSelectedContact(number); setRecipient(""); setError("");
        }}>
          <input aria-label="Customer number with country code" placeholder="Customer number" value={recipient} onChange={(event) => setRecipient(event.target.value)} className="min-w-0 flex-1 rounded border p-2 text-xs" />
          <button className="rounded border px-2 text-xs">Open</button>
        </form>
        {loading && <p className="text-sm text-gray-500">Loading chats…</p>}
        {!loading && !conversations.length && <p className="text-sm text-gray-500">No saved chats for this number yet. Click Refresh inbox to check for new messages.</p>}
        {conversations.map(([contact, last]) => <button key={contact} onClick={() => setSelectedContact(contact)} className={`mb-1 block w-full rounded-lg p-2 text-left ${active === contact ? "bg-green-50" : "hover:bg-gray-50"}`}>
          <span className="block text-sm font-medium">{contactNames[contact] || contact}</span>
          {contactNames[contact] && <span className="block text-xs text-gray-500">{contact}</span>}
          <span className="block truncate text-xs text-gray-500">{last.text}</span>
        </button>)}
      </aside>
      {active ? <Chat key={active} phoneNumberId={phoneNumberId} displayPhone={connection.displayPhone} contact={active}
        messages={messages.filter((message) => (message.direction === "in" ? message.from : message.to) === active)} onSent={onSent} />
        : <div className="flex items-center justify-center p-8 text-sm text-gray-500">Select a customer chat.</div>}
    </div>
  </div>;
}

function Chat({ phoneNumberId, displayPhone, contact, messages, onSent }: {
  phoneNumberId: string; displayPhone: string; contact: string; messages: ChatMessage[]; onSent: (message: ChatMessage) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [error, setError] = useState("");
  return <section className="flex min-w-0 flex-col p-4">
    <h3 className="border-b pb-3 text-sm font-semibold">{contact}<span className="mt-1 block text-xs font-normal text-gray-500">Replying from {displayPhone}</span></h3>
    <div className="max-h-[55vh] min-h-64 flex-1 space-y-2 overflow-y-auto py-4">
      {messages.map((message) => <div key={message.id} className={`w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${message.direction === "out" ? "ml-auto bg-green-700 text-white" : "bg-gray-100"}`}>
        {message.text}
        <time dateTime={new Date(message.timestamp).toISOString()} className="mt-1 block text-[10px] opacity-75">
          {new Date(message.timestamp).toLocaleString()}
        </time>
      </div>)}
    </div>
    {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
    <form className="flex gap-2" onSubmit={async (event) => {
      event.preventDefault();
      if (!draft.trim() || sendingRef.current) return;
      sendingRef.current = true; setSending(true); setError("");
      try {
        const result = await api("/api/whatsapp/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumberId, to: contact, text: draft.trim() }) });
        onSent(result.message); setDraft(""); if (result.warning) setError(result.warning);
      } catch (error) { setError(error instanceof Error ? error.message : "Could not send message."); }
      finally { sendingRef.current = false; setSending(false); }
    }}>
      <input aria-label="Reply" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending} maxLength={4096} placeholder="Type a reply…" className="min-w-0 flex-1 rounded-lg border p-2 text-sm" />
      <button disabled={sending || !draft.trim()} className={button}>{sending ? "Sending…" : "Send"}</button>
    </form>
    <p className="mt-2 text-xs text-gray-500">Text replies are subject to Meta&apos;s messaging window. Imported history does not reopen that window. Media appears as a caption or message-type label.</p>
  </section>;
}
