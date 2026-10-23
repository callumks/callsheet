# Setup

How to run Callsheet locally and deploy it. For what it is and how it works, see the [README](../README.md).

## Requirements

- Node 20+ and pnpm
- Postgres 15+
- A Google Cloud project with the Gmail API enabled
- An Anthropic API key

## Run locally

```bash
pnpm install
cp .env.example .env.local
createdb callsheet_dev
pnpm db:migrate
pnpm seed:demo --reset   # optional: fake jobs to look at
pnpm dev
```

Open `http://localhost:3000/sign-in` and sign in with the allow-listed Google account. Pull down on Upcoming, or tap the sync line, to run the first sync.

## Environment

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Postgres connection string. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth client of type *Web application*. Keep the consent screen in Testing with yourself as the only test user, so Google verification isn't needed. |
| `GOOGLE_REDIRECT_URI` | `<origin>/api/auth/callback/google`. Add the same URI to the OAuth client. |
| `ALLOWED_EMAIL` | The one Google account allowed to sign in. |
| `SESSION_SECRET` | Signs the session cookie. `openssl rand -base64 32` |
| `TOKEN_ENCRYPTION_KEY` | Encrypts the Gmail refresh token at rest. `pnpm keygen` |
| `ANTHROPIC_API_KEY` | Used for classify and extract. |
| `CLASSIFY_MODEL`, `EXTRACT_MODEL` | Optional. Default `claude-haiku-5-5` and `claude-opus-5-5`. |
| `AGENCY_DOMAINS` | Comma-separated sender domains that are always read. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push keys. `pnpm vapid` |
| `CRON_SECRET` | Shared secret the cron services send to the cron routes. |
| `INVOICE_TERMS_DAYS` | Optional. Days from invoicing to due date. Default 30. |
| `DEFAULT_TIMEZONE` | Optional. Used when a job has no zone. Default `Europe/London`. |
| `AGENT_TOKEN` | Optional. Bearer token for the phase 2 tool API. |

## Tests

```bash
pnpm db:test:setup   # once: creates and migrates callsheet_test
pnpm test            # unit and database tests, no network
pnpm eval:offline    # validates every fixture against the schema
pnpm eval            # runs the real models over the fixtures (costs a few cents)
```

Database tests run against `callsheet_test` from `.env.test` and refuse to touch any database whose URL doesn't contain `test`.

## Deploy on Railway

Three services from this repo, plus a Postgres database.

| Service | Config file | Does |
|---|---|---|
| `web` | `railway.json` | Builds, applies migrations before each deploy, serves the app. |
| `cron-sync` | `railway/cron-sync.json` | Every 15 minutes, calls `/api/cron/sync`. |
| `cron-reminders` | `railway/cron-reminders.json` | Every 5 minutes, calls `/api/cron/reminders`. |

1. Add Postgres to the project, then add this repo three times with the names above. Point each cron service at its config file in the service settings.
2. On `web`, set the variables above with `DATABASE_URL=${{Postgres.DATABASE_URL}}`. Generate a domain, set `GOOGLE_REDIRECT_URI` to `https://<domain>/api/auth/callback/google`, and add that URI to the OAuth client.
3. On both cron services, set `APP_URL=https://${{web.RAILWAY_PUBLIC_DOMAIN}}` and `CRON_SECRET=${{web.CRON_SECRET}}`.

## Notifications on iPhone

iOS only delivers web push to installed PWAs (iOS 16.4+). Open the app in Safari, Share, Add to Home Screen, then turn on notifications from the Earnings screen.

## Scripts

| Command | Does |
|---|---|
| `pnpm seed:demo [--reset]` | Fills the database with fictional jobs. `--reset` wipes it first. |
| `pnpm screenshots [url]` | Captures every screen, light and dark, into `docs/screens`. |
| `pnpm keygen` | Prints a new token encryption key. |
| `pnpm vapid` | Prints a new VAPID key pair. |
