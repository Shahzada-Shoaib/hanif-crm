"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className="mx-auto max-w-md px-6 py-16">
    <h1 className="text-2xl font-semibold">Sign in to Hanif CRM</h1>
    <p className="mt-2 text-sm text-gray-600">Use your workspace admin password to manage linked numbers and chats.</p>
    <form className="mt-6 space-y-4" onSubmit={async (event) => {
      event.preventDefault(); setBusy(true); setError("");
      try {
        const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        router.replace("/inbox"); router.refresh();
      } catch (error) { setError(error instanceof Error ? error.message : "Sign in failed."); }
      finally { setBusy(false); }
    }}>
      <label className="block text-sm">Admin password<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="rounded-lg bg-green-700 px-5 py-3 text-white disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  </div>;
}
