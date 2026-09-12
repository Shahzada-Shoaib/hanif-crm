"use client";

import { useEffect, useMemo, useState } from "react";

type ChatMessage = {
  id: string;
  from: string;
  to: string;
  text: string;
  direction: "in" | "out";
  timestamp: number;
};

export default function InboxPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    fetch("/api/whatsapp/messages")
      .then((res) => res.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => setError("Couldn’t load messages."));
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, []);

  const conversations = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const msg of messages) {
      const contact = msg.direction === "in" ? msg.from : msg.to;
      const prev = map.get(contact);
      if (!prev || msg.timestamp > prev.timestamp) map.set(contact, msg);
    }
    return [...map.entries()].sort((a, b) => b[1].timestamp - a[1].timestamp);
  }, [messages]);

  useEffect(() => {
    if (!active && conversations[0]) setActive(conversations[0][0]);
  }, [active, conversations]);

  const thread = messages.filter((msg) => {
    const contact = msg.direction === "in" ? msg.from : msg.to;
    return contact === active;
  });

  const send = () => {
    if (!active || !draft.trim()) return;
    setError("");
    fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: active, text: draft.trim() }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) {
          setError(data.error || "Couldn’t send message.");
          return;
        }
        setDraft("");
        load();
      })
      .catch(() => setError("Couldn’t send message."));
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-5xl border-x border-gray-200">
      <aside className="w-72 border-r border-gray-200 p-4">
        <h1 className="text-lg font-semibold">Conversations</h1>
        <p className="mt-1 text-xs text-gray-500">WhatsApp customer inbox</p>
        <div className="mt-4 space-y-1">
          {conversations.length === 0 && (
            <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
              No messages yet. Connect WhatsApp, then customer chats will appear
              here.
            </p>
          )}
          {conversations.map(([contact, last]) => (
            <button
              key={contact}
              type="button"
              onClick={() => setActive(contact)}
              className={`block w-full rounded-lg p-3 text-left text-sm ${
                active === contact ? "bg-green-50" : "hover:bg-gray-50"
              }`}
            >
              <div className="font-medium text-gray-900">{contact}</div>
              <div className="truncate text-gray-500">{last.text}</div>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex flex-1 flex-col p-4">
        {!active ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500">
            Select a conversation to view messages.
          </div>
        ) : (
          <>
            <h2 className="border-b border-gray-200 pb-3 font-semibold">
              {active}
            </h2>
            <div className="flex-1 space-y-2 overflow-y-auto py-4">
              {thread.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    msg.direction === "out"
                      ? "ml-auto bg-green-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {msg.text}
                </div>
              ))}
            </div>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Type a reply…"
              />
              <button
                type="submit"
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Send
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
