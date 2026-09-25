# Hanif CRM

Sign in, open Meta-hosted Coexistence onboarding, then return to the inbox to
select a number and reply. This is the only primary onboarding flow.

The browser opens Meta directly. Next.js handles signed webhooks, account tokens,
history import and messaging. No Facebook SDK or OAuth callback is needed.
Manual import is available under Advanced settings for recovery.

Requires Node.js 24+ and persistent SQLite storage.

```powershell
npm.cmd install
npm.cmd run setup:local
npm.cmd run dev
```

See [SETUP.md](./SETUP.md) and [COEXISTENCE.md](./COEXISTENCE.md).

Checks: `npm.cmd test`, `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `npm.cmd run build`.
