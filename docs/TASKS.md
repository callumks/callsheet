# Build tasks

One commit per task. Ticked when it lands on `main`.

## Milestone 1 — Pipeline

- [x] 01 Foundation: theme tokens, fonts, dark mode, PWA manifest, app shell with floating nav, this list
- [x] 02 Database: google_accounts + push_subscriptions tables, migrations, local dev DB
- [x] 03 Crypto: AES-256-GCM encrypt/decrypt for the Gmail refresh token, tested
- [x] 04 Auth: Google sign-in with gmail.readonly, allow-list of one, signed session cookie, route guard
- [x] 05 Gmail client: history fetch, message headers, body on demand, token refresh
- [x] 06 Filter: agency domain allow-list + booking-word subject match, tested
- [x] 07 Classify: one cheap LLM call → new_booking / update / travel / payment / irrelevant
- [x] 08 Extract: strict JSON schema via structured outputs, Zod-validated, nulls over guesses
- [ ] 09 Upsert: thread-id then agency + client + date-overlap matching, writes jobs / travel / invoices, tested against the DB
- [ ] 10 Reminder scheduling: night-before, 2h-before, invoice-due, overdue, in the job's time zone, tested
- [ ] 11 Cron: /api/cron/sync runs the five steps, vercel.json schedule, CRON_SECRET
- [ ] 12 Fixtures: 20+ redacted booking emails with expected output, `pnpm eval` runs the extractor over them

## Milestone 2 — Screens

- [ ] 13 Upcoming: hero card for the next job, 14-day list with status dots, pull to resync
- [ ] 14 Job detail: every field inline-editable, mark invoiced / paid, Needs review banner, source email link
- [ ] 15 Earnings: month total, paid / invoiced / to-invoice bar, 6-month bars, unpaid list

## Milestone 3 — Reminders

- [ ] 16 Web push: service worker, subscribe flow, VAPID send, /api/cron/reminders
- [ ] 17 Invoice nudges: invoice_due the day after wrap, overdue at due + 1 day then weekly

## Milestone 4 — Polish and ship

- [ ] 18 Empty, loading and error states; dark mode pass
- [ ] 19 Demo seed: `pnpm seed:demo` fills the DB with fake jobs for screenshots
- [ ] 20 README: architecture, setup, screenshots, status

## Phase 2 (not in v1)

- [ ] 21 Tool API over the database: list_jobs, get_job, earnings, unpaid, draft_invoice_chase
