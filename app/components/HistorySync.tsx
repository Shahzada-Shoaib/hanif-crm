"use client";

import { useEffect, useState } from "react";

type Status = { status: string; progress: number; count: number; error: string | null; contactError: string | null; contactStatus: string };

export default function HistorySync({ phoneNumberId }: { phoneNumberId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let stopped = false;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch(`/api/whatsapp/history?phoneNumberId=${encodeURIComponent(phoneNumberId)}`, { cache: "no-store", signal: controller.signal });
        if (response.status === 401) { window.location.reload(); return; }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load history status.");
        if (!stopped) setStatus(data);
      } catch (cause) { if (!stopped) setError(cause instanceof Error ? cause.message : "Could not load history status."); }
    };
    void refresh();
    return () => { stopped = true; controller.abort(); };
  }, [phoneNumberId]);

  const start = async () => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/whatsapp/history", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId, retry: status?.status === "failed" || status?.contactStatus === "failed" }) });
      if (response.status === 401) { window.location.reload(); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start history import.");
      setStatus(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start history import."); }
    finally { setBusy(false); }
  };

  return <section className="border-b bg-gray-50 px-4 py-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status">{!status ? "Loading history status..."
        : status.status === "receiving" ? `${status.count} historical messages saved · Meta progress ${status.progress}%`
        : status.status === "requested" ? "History requested. Waiting for Meta to deliver chats..."
        : status.status === "requesting" ? "History request started. Awaiting confirmation; it will not be sent twice."
        : status.status === "uncertain" ? "History request needs review. Check Meta delivery logs."
        : "Import the chat history you shared from WhatsApp Business."}</p>
      {status && (["not_started", "failed"].includes(status.status) || status.contactStatus === "failed") && <button type="button" disabled={busy}
        onClick={() => void start()} className="font-semibold text-green-800 underline disabled:opacity-50">
        {busy ? "Requesting..." : status.status === "failed" || status.contactStatus === "failed" ? "Retry rejected import" : "Import shared history"}
      </button>}
    </div>
    {(error || status?.error) && <p role="alert" className="mt-2 text-red-700">{error || status?.error}</p>}
    {status?.contactError && <p className="mt-2 text-amber-800">Contacts: {status.contactError}</p>}
    <p className="mt-1 text-xs text-gray-500">For Coexistence numbers with history sharing allowed. Keep WhatsApp Business open during sync. Only history delivered by Meta can appear here.</p>
  </section>;
}
