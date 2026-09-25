import { db } from "./db";
import { decryptToken, encryptToken } from "./secrets";
import type { Connection } from "./types";
function publicConnection(row: Record<string, unknown>): Connection {
  return {
    phoneNumberId: String(row.phone_number_id), wabaId: String(row.waba_id),
    displayPhone: String(row.display_phone), verifiedName: String(row.verified_name),
    webhookSubscribed: !!row.webhook_subscribed, updatedAt: Number(row.updated_at),
  };
}
export function listConnections(): Connection[] {
  return db().prepare("SELECT phone_number_id,waba_id,display_phone,verified_name,webhook_subscribed,updated_at FROM connections ORDER BY display_phone").all().map(publicConnection);
}
export function getConnection(id: string) {
  const row = db().prepare("SELECT * FROM connections WHERE phone_number_id = ?").get(id);
  return row ? publicConnection(row) : null;
}
export function getCredentials(id: string) {
  const row = db().prepare("SELECT * FROM connections WHERE phone_number_id = ?").get(id);
  return row ? { ...publicConnection(row), accessToken: decryptToken(String(row.encrypted_token), id) } : null;
}
export function saveConnections(connections: Connection[], token: string, replaceWabaId?: string) {
  if (replaceWabaId && connections.some(c => c.wabaId !== replaceWabaId)) throw new Error("Account mismatch.");
  const rows = connections.map((c) => ({ c, token: encryptToken(token, c.phoneNumberId) }));
  const database = db();
  database.exec("BEGIN IMMEDIATE");
  try {
    // Replace only the account whose complete list was fetched successfully.
    if (replaceWabaId) database.prepare("DELETE FROM connections WHERE waba_id = ?").run(replaceWabaId);
    const upsert = database.prepare(`INSERT INTO connections VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(phone_number_id) DO UPDATE SET waba_id=excluded.waba_id,
      display_phone=excluded.display_phone, verified_name=excluded.verified_name,
      encrypted_token=excluded.encrypted_token, webhook_subscribed=excluded.webhook_subscribed,
      updated_at=excluded.updated_at`);
    for (const { c, token: encrypted } of rows) {
      upsert.run(c.phoneNumberId, c.wabaId, c.displayPhone, c.verifiedName, encrypted, Number(c.webhookSubscribed), c.updatedAt);
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
