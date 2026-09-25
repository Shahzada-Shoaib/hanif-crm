import { createHmac } from "node:crypto";
import { db } from "./db";
import { graph } from "./meta";

// IDs come from stored, signature-verified PARTNER_ADDED events, not browser input.
export async function fetchHostedBusinessToken(wabaId: string, systemToken: string) {
  let ownerId = "";
  const events = db().prepare("SELECT payload FROM account_updates ORDER BY received_at DESC").all();
  for (const event of events) {
    try {
      const { value } = JSON.parse(String(event.payload));
      const info = value?.waba_info;
      if (value?.event === "PARTNER_ADDED" && info?.waba_id === wabaId &&
          typeof info.owner_business_id === "string" && /^\d+$/.test(info.owner_business_id)) {
        ownerId = info.owner_business_id;
        break;
      }
    } catch { /* Ignore malformed archived events. */ }
  }
  if (!ownerId) throw new Error("The signed onboarding event is missing the customer's business portfolio ID. Import the WABA with its authorized business token, or check account_update deliveries.");
  const secret = process.env.META_APP_SECRET;
  if (!secret) throw new Error("Configure META_APP_SECRET before fetching the customer business token.");
  const proof = createHmac("sha256", secret).update(systemToken).digest("hex");
  const result = await graph<{ access_token?: string }>(`${ownerId}/system_user_access_tokens`, systemToken, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ appsecret_proof: proof, fetch_only: "true" }).toString(),
  });
  if (typeof result.access_token !== "string" || !result.access_token.trim()) {
    throw new Error("Meta did not return a customer business token. Check the hosted signup grant and system-token access.");
  }
  return result.access_token;
}
