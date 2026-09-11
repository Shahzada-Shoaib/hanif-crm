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
      .catch(() => setError("Messages load failed"));
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
          setError(data.error || "Send failed");
          return;
        }
        setDraft("");
        load();
      })
      .catch(() => setError("Send failed"));
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-72 border-r p-4">
        <a href="/" className="text-sm text-gray-500">
          ← Home
        </a>
        <h1 className="mt-2 text-xl font-bold">Inbox</h1>
        <div className="mt-4 space-y-2">
          {conversations.length === 0 && (
            <p className="text-sm text-gray-500">Abhi koi chat nahi.</p>
          )}
          {conversations.map(([contact, last]) => (
            <button
              key={contact}
              type="button"
              onClick={() => setActive(contact)}
              className={`block w-full rounded p-2 text-left text-sm ${
                active === contact ? "bg-green-100" : "hover:bg-gray-100"
              }`}
            >
              <div className="font-medium">{contact}</div>
              <div className="truncate text-gray-500">{last.text}</div>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex flex-1 flex-col p-4">
        {!active ? (
          <p className="text-gray-500">Koi conversation select karo.</p>
        ) : (
          <>
            <h2 className="border-b pb-2 font-bold">{active}</h2>
            <div className="flex-1 space-y-2 overflow-y-auto py-4">
              {thread.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-[70%] rounded px-3 py-2 ${
                    msg.direction === "out"
                      ? "ml-auto bg-green-600 text-white"
                      : "bg-gray-100"
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
                className="flex-1 rounded border px-3 py-2"
                placeholder="Reply..."
              />
              <button
                type="submit"
                className="rounded bg-green-600 px-4 py-2 text-white"
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
