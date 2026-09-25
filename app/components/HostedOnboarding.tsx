"use client";

import { useEffect, useState } from "react";
import type { Connection } from "@/lib/types";

type Settings = { url: string | null; tokenConfigured: boolean;
  jobs: { wabaId: string; status: string; error: string | null }[] };

export default function HostedOnboarding({ onConnections }: { onConnections: (connections: Connection[]) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let stopped = false;
    const controller = new AbortController();
    let first = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/whatsapp/hosted", { method: "POST", signal: controller.signal,
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ retry: first && retry > 0 }) });
        first = false;
        if (response.status === 401) { window.location.reload(); return; }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not check onboarding.");
        if (!stopped) { setSettings(data); onConnections(data.connections); setError(""); }
      } catch (cause) { if (!stopped) setError(cause instanceof Error ? cause.message : "Could not check onboarding."); }
    };
    void refresh();
    return () => { stopped = true; controller.abort(); };
  }, [onConnections, retry]);

  return <section className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm">
    <h2 className="mb-2 font-semibold">Connect your WhatsApp Business app</h2>
    <p className="mb-3">Complete Meta onboarding and allow chat history sharing on your phone. Return here and click Refresh inbox to see updates.</p>
    {settings?.url ? <a href={settings.url} target="_blank" rel="noopener noreferrer"
      className="inline-block rounded-lg bg-green-700 px-4 py-2 font-semibold text-white">Open Meta onboarding</a>
      : <p>{settings ? "Set META_HOSTED_CONFIG_ID on the server to enable your Meta onboarding link." : "Loading onboarding..."}</p>}
    {settings && !settings.tokenConfigured && <p className="mt-2 text-amber-900">Automatic import needs a server access token. You can also import your WABA using Advanced settings.</p>}
    {settings?.jobs.map(job => <p key={job.wabaId} className="mt-2" role="status">
      Account {job.wabaId}: {job.status === "complete" ? "Connected. Select its number to view history progress."
        : job.error || (settings.tokenConfigured ? "Preparing your inbox..." : "Waiting for account access.")}
    </p>)}
    {settings?.jobs.some(job => job.status === "failed") && <button type="button" onClick={() => setRetry(value => value + 1)}
      className="mt-2 underline">Retry account setup</button>}
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  </section>;
}
