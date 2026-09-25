# Setup

Use Node.js 24+ and run commands inside `crm-frontend`.
For a new installation, copy `env.example` to `.env.local`, fill in Meta settings,
then run `npm.cmd run setup:local` and `npm.cmd run dev`.
For existing installations retain `.env.local` and the encryption key.
The setup script only adds missing CRM credentials.

| Variable | Purpose |
| --- | --- |
| `META_APP_ID` | App used by the hosted onboarding link |
| `META_HOSTED_CONFIG_ID` | Hosted Coexistence configuration ID |
| `META_APP_SECRET` | Server-side token proof and webhook signature verification |
| `META_SYSTEM_USER_ACCESS_TOKEN` | Provider system token for hosted account import |
| `NEXT_PUBLIC_APP_URL` | Public HTTPS CRM origin |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification value configured in Meta |
| `CRM_ADMIN_PASSWORD` | Workspace login password |
| `CRM_ENCRYPTION_KEY` | Persistent key for encrypted saved tokens |
| `META_GRAPH_VERSION` | Optional Graph version; defaults to `v26.0` |
| `CRM_DATA_DIR` | Optional persistent SQLite directory; defaults to `data/` |

`WHATSAPP_ACCESS_TOKEN` remains a compatibility fallback for the provider system
token. It does not select the sending number. `NEXT_PUBLIC_META_CONFIG_ID` and
`META_REDIRECT_URI` are no longer used and can be removed from old environment files.

## Connect and reply

1. Sign in at `/login` with `CRM_ADMIN_PASSWORD`.
2. In the inbox, click **Open Meta onboarding** to open Meta directly.
3. Connect your WhatsApp Business app and allow history sharing.
4. Return to the inbox; signed account webhooks trigger account import and history sync.
5. Select your number and a customer conversation to reply.

Automatic browser polling is disabled. Click **Refresh inbox** to reload linked
numbers, messages and history status. Webhooks still receive and save new data.

Configure Meta's webhook callback as `https://YOUR-HOST/api/whatsapp/webhook`.
See [COEXISTENCE.md](./COEXISTENCE.md) for required fields, provider token
permissions, history behavior and live checks. The standalone FastAPI webhook
is not part of this flow; run the Next.js server.

## Advanced settings

Manual WABA ID/token import supports recovery of existing accounts and token
replacement. **Sync account numbers** refreshes the selected account's number list.
A successful import/sync replaces that account's saved connections with the list
returned by Meta; chats remain stored. Other accounts remain linked.
Tokens are encrypted and are not returned to the browser.

**Clear database** asks for confirmation and clears all local numbers, saved tokens,
messages, contacts, onboarding events and sync records. It preserves configuration
and migration markers so legacy messages are not re-imported on restart. It does
not unlink numbers on Meta; future webhooks can add data again. Active onboarding
or history requests must finish before clearing.

## Storage and checks

This is one private admin workspace: everyone with its password can manage all
linked numbers. Run one Node server with persistent SQLite storage. Default
ephemeral/serverless storage is unsuitable. Back up SQLite and retain the encryption
key separately. Existing messages and saved connections are preserved during cleanup.

Run `npm.cmd test`, `npm.cmd run lint`, `npx.cmd tsc --noEmit` and
`npm.cmd run build`. Tests use temporary storage and mocked Meta requests.
Live onboarding, history delivery and replies also need checking with a real account.
