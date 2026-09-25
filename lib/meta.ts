import { saveConnections } from "./connections";
import { encryptionKey } from "./secrets";
import type { Connection } from "./types";

export class MetaError extends Error {
  constructor(message: string, public code?: number) { super(message); }
}
export async function graph<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const version = process.env.META_GRAPH_VERSION || "v26.0";
  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/${version}/${path}`, {
      ...init, cache: "no-store", signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", ...init?.headers, Authorization: `Bearer ${token}` },
    });
  } catch { throw new MetaError("Could not reach Meta. Please try again."); }
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error || !data) {
    const code = data?.error?.code;
    // Do not expose upstream payloads or tokens to clients/logs.
    throw new MetaError(code === 190
      ? "Meta rejected this access token (190). Import this account again with a valid token."
      : `Meta request failed${code ? ` (code ${code})` : ""}. Check account access, permissions and messaging requirements.`, code);
  }
  return data as T;
}

type Phone = { id: string; display_phone_number?: string; verified_name?: string };
type PhonePage = { data: Phone[]; paging?: { next?: string; cursors?: { after?: string } } };
export async function importAccount(wabaId: string, accessToken: string) {
  if (!/^\d+$/.test(wabaId)) throw new Error("Enter a numeric WhatsApp Business Account ID.");
  encryptionKey();
  const phones: Phone[] = [];
  let after = "";
  const seenCursors = new Set<string>();
  do {
    const query = new URLSearchParams({ fields: "id,display_phone_number,verified_name", limit: "100" });
    if (after) query.set("after", after);
    const page = await graph<PhonePage>(`${wabaId}/phone_numbers?${query}`, accessToken);
    if (!Array.isArray(page.data)) throw new Error("Meta did not return a phone number list.");
    phones.push(...page.data);
    after = page.paging?.next ? page.paging.cursors?.after || "" : "";
    if (after && seenCursors.has(after)) throw new Error("Meta returned an invalid pagination cursor. Please retry.");
    seenCursors.add(after);
  } while (after);
  if (!phones.length) {
    saveConnections([], accessToken, wabaId);
    return { connections: [], warning: "No numbers returned by Meta. The saved list for this account has been cleared." };
  }
  if (phones.some((phone) => !/^\d+$/.test(phone.id))) throw new Error("Meta returned an invalid phone number ID.");
  let webhookSubscribed = false;
  let warning: string | null = null;
  try {
    const result = await graph<{ success: boolean }>(`${wabaId}/subscribed_apps`, accessToken, { method: "POST", body: "{}" });
    webhookSubscribed = result.success === true;
    if (!webhookSubscribed) warning = "Numbers saved, but webhook subscription was not confirmed. Retry Sync after checking Meta permissions.";
  } catch (error) {
    warning = `Numbers saved, but webhook subscription failed. ${error instanceof MetaError ? error.message : "Retry Sync."}`;
  }
  const connections: Connection[] = phones.map((phone) => ({
    phoneNumberId: phone.id, wabaId, displayPhone: phone.display_phone_number || phone.id,
    verifiedName: phone.verified_name || "WhatsApp Business", webhookSubscribed, updatedAt: Date.now(),
  }));
  saveConnections(connections, accessToken, wabaId);
  return { connections, warning };
}
