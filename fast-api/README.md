# Hanif CRM FastAPI backend

Copy `.env.example` to `.env`, set `DATABASE_URL` to the local PostgreSQL database, and fill in the Meta and CRM values. For example:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@127.0.0.1:5432/YOUR_DATABASE
```

```powershell
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

## Database migrations

The imported database must contain the complete schema and functions from the Supabase dump. For a database missing later changes, run the SQL files in `migrations/` in numeric order using pgAdmin's Query Tool or `psql`. Migration `003_conversations_and_pagination.sql` is additive: it backfills persistent conversation summaries, adds cursor-pagination indexes and installs the functions used by the inbox. Migration `005_message_revisions.sql` preserves original message bodies while recording WhatsApp edits and deletions. Migration `006_message_reactions.sql` stores message reactions, `007_multi_tenant_users.sql` adds database-backed accounts and sessions, `008_simple_saas_workspaces.sql` separates SaaS workspaces from companies with per-user company access, and `009_onboarding_intent.sql` safely binds hosted onboarding to the selected company.

Do not deploy the backend before all matching migrations have completed successfully. On the first login after migration 007, the configured `CRM_ADMIN_USERNAME` (default `admin`) and `CRM_ADMIN_PASSWORD` create the initial super-admin account.

Public registration creates a workspace admin. That admin creates companies, connects WhatsApp numbers and gives team users access to one or more companies. The super-admin sees account summaries only and cannot open tenant inboxes.

Meta webhook URL: `https://YOUR-PUBLIC-API/api/whatsapp/webhook` (the shorter `/webhook` alias also works).

The API includes tenant-scoped user sessions, companies, connections, inbox messages, sending, SSE updates, hosted-onboarding status, coexistence history requests, signed webhook ingestion, and encrypted Meta tokens.

## Local WhatsApp media storage

Incoming images, videos, audio, stickers, and documents are downloaded in the background when their webhook is received. By default they are stored under `fast-api/storage/media/<phone-number-id>/<media-id>`. The authenticated media endpoint serves the local copy and downloads it from Meta on demand if the background download has not completed yet.

Set `MEDIA_ROOT` to move the files without changing the application code:

```env
# Local development (relative paths are resolved from fast-api/)
MEDIA_ROOT=storage/media

# Example VPS location
# MEDIA_ROOT=/var/lib/hanif-crm/media
```

Keep this directory private and back it up separately. Do not expose it as a public Nginx static directory.
