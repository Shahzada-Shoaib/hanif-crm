import { db } from "./db";
import { getCredentials } from "./connections";
import { graph, MetaError } from "./meta";
import { historyStatus } from "./coexistence-events";

type SyncKind = "history" | "smb_app_state_sync";

async function requestOnce(phoneNumberId: string, token: string, kind: SyncKind, retry: boolean) {
  const database = db();
  if (kind === "history" && database.prepare("SELECT 1 FROM history_progress WHERE phone_number_id = ?").get(phoneNumberId)) return;
  // A live contact update is not proof that the one-time contact import was requested.
  // Claim before the network call. Never repeat a request whose outcome is unknown.
  if (retry) database.prepare("DELETE FROM coexistence_requests WHERE phone_number_id = ? AND kind = ? AND status = 'failed'").run(phoneNumberId, kind);
  const claim = database.prepare("INSERT OR IGNORE INTO coexistence_requests VALUES (?, ?, 'requesting', NULL, NULL, ?)")
    .run(phoneNumberId, kind, Date.now());
  if (!claim.changes) return;
  try {
    const response = await graph<{ request_id?: string }>(`${phoneNumberId}/smb_app_data`, token, {
      method: "POST", body: JSON.stringify({ messaging_product: "whatsapp", sync_type: kind }),
    });
    const confirmed = typeof response.request_id === "string" && !!response.request_id;
    database.prepare("UPDATE coexistence_requests SET status=?, request_id=?, error=?, updated_at=? WHERE phone_number_id=? AND kind=?")
      .run(confirmed ? "requested" : "uncertain", response.request_id || null,
        confirmed ? null : "Meta returned no request ID. Check webhook deliveries before attempting another sync.", Date.now(), phoneNumberId, kind);
  } catch (error) {
    const rejected = error instanceof MetaError && error.code !== undefined;
    const message = rejected
      ? `${error.message} Check history consent and the onboarding sync window before retrying.`
      : "Sync response was not received. It may already be running; check Meta webhook deliveries. It will not be retried automatically.";
    database.prepare("UPDATE coexistence_requests SET status=?, error=?, updated_at=? WHERE phone_number_id=? AND kind=?")
      .run(rejected ? "failed" : "uncertain", message, Date.now(), phoneNumberId, kind);
  }
}

export async function startCoexistenceSync(phoneNumberId: string, retry = false) {
  const connection = getCredentials(phoneNumberId);
  if (!connection) throw new Error("Import this WhatsApp account first.");
  const phone = await graph<{ is_on_biz_app?: boolean }>(`${phoneNumberId}?fields=is_on_biz_app`, connection.accessToken);
  if (phone.is_on_biz_app !== true) throw new Error("Meta has not identified this number as a WhatsApp Business app Coexistence number.");
  const appId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  if (!appId || !secret) throw new Error("Configure the Meta app ID and secret first.");
  const subscriptions = await graph<{ data?: { object?: string; active?: boolean; callback_url?: string; fields?: { name?: string }[] }[] }>(
    `${appId}/subscriptions`, `${appId}|${secret}`);
  const subscribed = subscriptions.data?.find(item => item.object === "whatsapp_business_account" && item.active === true);
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin || subscribed?.callback_url !== new URL("/api/whatsapp/webhook", origin).href) {
    throw new Error("The Meta callback must match this CRM's public URL plus /api/whatsapp/webhook. Check NEXT_PUBLIC_APP_URL before importing history.");
  }
  const fields = new Set(subscribed?.fields?.map(field => field.name));
  if (!["messages", "history", "smb_app_state_sync", "smb_message_echoes"].every(field => fields.has(field))) {
    throw new Error("In Meta, verify the webhook and subscribe messages, history, smb_app_state_sync and smb_message_echoes before importing history.");
  }
  const subscription = await graph<{ success?: boolean }>(`${connection.wabaId}/subscribed_apps`, connection.accessToken, { method: "POST", body: "{}" });
  if (!subscription.success) throw new Error("Meta did not confirm the account webhook subscription.");
  // Contacts and history are independent one-time requests; a contact failure must not block history.
  await requestOnce(phoneNumberId, connection.accessToken, "smb_app_state_sync", retry);
  await requestOnce(phoneNumberId, connection.accessToken, "history", retry);
  return historyStatus(phoneNumberId);
}
