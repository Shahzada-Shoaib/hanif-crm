import { db } from "./db";
import { importAccount } from "./meta";
import { startCoexistenceSync } from "./coexistence-sync";
import { fetchHostedBusinessToken } from "./hosted-business-token";

export function hostedToken() { return process.env.META_SYSTEM_USER_ACCESS_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN; }

export function hostedSettings() {
  const appId = process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.META_HOSTED_CONFIG_ID;
  const url = appId && configId && /^\d+$/.test(appId) && /^\d+$/.test(configId)
    ? `https://business.facebook.com/messaging/whatsapp/onboard/?app_id=${appId}&config_id=${configId}` : null;
  return { url, tokenConfigured: !!hostedToken(), jobs: db().prepare("SELECT waba_id AS wabaId, status, error FROM hosted_onboarding ORDER BY updated_at DESC").all() };
}

// Jobs originate only in signature-verified account_update webhooks.
// A persistent claim makes webhook retries and concurrent inbox polling safe.
export async function reconcileHosted(retry = false) {
  const database = db();
  const token = hostedToken();
  if (!token) return;
  // Recover events received by the previous webhook implementation before this feature was installed.
  for (const record of database.prepare("SELECT payload FROM account_updates").all()) {
    try {
      const saved = JSON.parse(String(record.payload));
      const wabaId = saved.value?.waba_info?.waba_id;
      if (saved.value?.event === "PARTNER_ADDED" && typeof wabaId === "string" && /^\d+$/.test(wabaId)) {
        database.prepare("INSERT OR IGNORE INTO hosted_onboarding VALUES (?, 'pending', NULL, ?)").run(wabaId, Date.now());
      }
    } catch { /* Leave malformed legacy events archived. */ }
  }
  if (retry) database.prepare("UPDATE hosted_onboarding SET status='pending', error=NULL WHERE status='failed'").run();
  database.prepare("UPDATE hosted_onboarding SET status='pending' WHERE status='processing' AND updated_at < ?").run(Date.now() - 10 * 60 * 1000);
  const job = database.prepare("SELECT waba_id FROM hosted_onboarding WHERE status='pending' ORDER BY updated_at LIMIT 1").get();
  if (!job) return;
  const id = String(job.waba_id);
  if (!database.prepare("UPDATE hosted_onboarding SET status='processing', updated_at=? WHERE waba_id=? AND status='pending'").run(Date.now(), id).changes) return;
  try {
    const businessToken = await fetchHostedBusinessToken(id, token);
    const result = await importAccount(id, businessToken);
    if (result.warning) throw new Error(result.warning);
    const errors: string[] = [];
    for (const phone of result.connections) {
      try {
        const status = await startCoexistenceSync(phone.phoneNumberId);
        if (status.error) errors.push(`${phone.displayPhone}: ${status.error}`);
      } catch (error) {
        errors.push(`${phone.displayPhone}: ${error instanceof Error ? error.message : "Could not prepare history."}`);
      }
    }
    if (errors.length) throw new Error(errors.join(" "));
    database.prepare("UPDATE hosted_onboarding SET status='complete', error=NULL, updated_at=? WHERE waba_id=?").run(Date.now(), id);
  } catch (error) {
    database.prepare("UPDATE hosted_onboarding SET status='failed', error=?, updated_at=? WHERE waba_id=?")
      .run(error instanceof Error ? error.message : "Account import failed. Check server token permissions.", Date.now(), id);
  }
}
