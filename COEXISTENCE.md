# WhatsApp Business app history in the CRM

This is the existing single-admin workspace: everyone with the CRM password can see
all imported accounts. It is not a separate workspace per customer.

## Configure once

1. Keep the Next.js server and its public HTTPS tunnel running. The receiver is
   `https://YOUR-CRM-HOST/api/whatsapp/webhook` (not the FastAPI sample).
2. In Meta, verify that callback using `WHATSAPP_VERIFY_TOKEN`. Subscribe to
   `account_update`, `messages`, `history`, `smb_app_state_sync`, and
   `smb_message_echoes`. `account_update` is needed to discover accounts completed
   through the hosted link. App-level field subscriptions and WABA subscriptions
   are different; the CRM handles WABA subscription during import.
3. Set `META_HOSTED_CONFIG_ID=3264827733702626` for the supplied hosted link.
   Keep `META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION`, and
   `NEXT_PUBLIC_APP_URL` aligned with that app and this running CRM.
4. Set server-only `META_SYSTEM_USER_ACCESS_TOKEN` to your provider's system token.
   Hosted signup must grant the required WhatsApp management/messaging permissions.
   The existing `WHATSAPP_ACCESS_TOKEN` is a compatibility fallback only if it is
   the appropriate system token. The server uses the app secret to generate
   `appsecret_proof`, then POSTs `fetch_only=true` to the customer's
   `/{owner_business_id}/system_user_access_tokens` endpoint. The returned customer
   business token is used for WABA import and sync, and encrypted when saved.
   Neither token is returned to the browser.
5. Restart the development/production server after changing environment values.

## New onboarding

Open **Inbox → Open Meta onboarding**, connect the WhatsApp Business app number,
and allow history sharing on the phone. Keep the Business app open while syncing.
Meta's signed `account_update` / `PARTNER_ADDED` event creates a persistent import
job. The event's `waba_info.waba_id` identifies the WABA and
`waba_info.owner_business_id` identifies the customer's business portfolio. They
are distinct IDs; neither is inferred from a fixed `WHATSAPP_WABA_ID` setting.
After acknowledging the webhook, the server fetches the customer business token to import the WABA,
verify Coexistence and callback field subscriptions, subscribe the WABA, and request
contacts and history. Returning to the inbox also resumes pending jobs and refreshes
the number list when you click **Refresh inbox**. Automatic browser polling is disabled.

If access/configuration fails, the inbox displays the account error. Correct it and
choose **Retry account setup**. This retries account preparation; it does not blindly
repeat one-time requests that may already have been accepted.

## A number onboarded earlier today

An earlier onboarding may not have emitted `account_update` to this app if that field
was not subscribed. Do not assume toggling the field will replay that event.

Use **Advanced settings → Import existing numbers**, enter the new WABA ID and its
authorized token, then select its number and click **Import shared history**.
Events already received by the old handler are recovered from `account_updates`
where available. Historical messages received before account import are stored
under their original phone number ID and become visible when that number is imported.

Initiate sync promptly after onboarding. Meta controls the permitted sync window,
consent, one-time behavior, and available history; a successful request ID confirms
acceptance, not that all chats have arrived. The CRM does not offboard/re-register a
number to force another history import.

## What appears in the inbox

- Incoming/outgoing historical text with original timestamps, grouped by customer.
- Contact names when delivered by `smb_app_state_sync`.
- New incoming messages and outbound Business app messages (`smb_message_echoes`).
- Historical message count and Meta-reported progress. Progress is not an assertion
  that every chunk arrived: deliveries can be delayed or out of order.
- Media captions/type labels; binary media download and playback are not implemented.
  Raw signed Coexistence events remain in SQLite for diagnosis/reprocessing. Later
  media details can replace a saved placeholder without duplicating the message.

Original message IDs are deduplicated per business number. Historical messages
never trigger auto-replies and do not reopen Meta's free-form messaging window.
Webhook inserts run in a transaction; storage failures return an error for delivery
retry. Do not delete the SQLite database or change its encryption key to retry sync.

## Interrupted requests

Contacts and history each have a persisted one-time request record. Definitive Meta
rejections can be explicitly retried after fixing the cause. A timeout, malformed
success response, or process interruption is not automatically retried: Meta may
have accepted the request. Check the delivery logs and request records before any
manual recovery. The UI distinguishes waiting, received history, and errors.

## Verification

`npm test` uses an isolated SQLite database and mocked Graph API calls. It covers
signed history/echo/contact ingestion, duplicates, chronology, direction, number
isolation, request authentication, wrong callbacks, missing subscriptions, concurrent
requests, ambiguous timeouts, and hosted account discovery. These tests do not prove
that a real Meta token, customer account, or tunnel is correctly configured.

For a live acceptance check, complete one consented onboarding, confirm the WABA
appears without exposing a token in the browser, inspect history count/progress,
compare an old incoming and outgoing text against the phone, send a new text from
the Business app, and verify it appears once as outgoing in the same conversation.
Restart and confirm the number and messages remain saved.

Reference: [Meta Coexistence onboarding documentation](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users).
