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
- [x] 09 Upsert: thread-id then agency + client + date-overlap matching, writes jobs / travel / invoices, tested against the DB
- [x] 10 Reminder scheduling: night-before, 2h-before, invoice-due, overdue, in the job's time zone, tested
- [x] 11 Cron: /api/cron/sync runs the five steps, vercel.json schedule, CRON_SECRET
- [x] 12 Fixtures: 20+ redacted booking emails with expected output, `pnpm eval` runs the extractor over them

## Milestone 2 — Screens

- [x] 13 Upcoming: hero card for the next job, 14-day list with status dots, pull to resync
- [x] 14 Job detail: every field inline-editable, mark invoiced / paid, Needs review banner, source email link
- [x] 15 Earnings: month total, paid / invoiced / to-invoice bar, 6-month bars, unpaid list

## Milestone 3 — Reminders

- [x] 16 Web push: service worker, subscribe flow, VAPID send, /api/cron/reminders
- [x] 17 Invoice nudges: invoice_due the day after wrap, overdue at due + 1 day then weekly

## Milestone 4 — Polish and ship

- [x] 18 Empty, loading and error states; dark mode pass
- [x] 19 Demo seed: `pnpm seed:demo` fills the DB with fake jobs for screenshots
- [x] 20 README: architecture, setup, screenshots, status

## Beyond v1

- [x] 22 More than one user: users table, user_id on every row, sign-in separate from connecting Gmail, every read and write scoped to the signed-in user, reconnect prompt when Google revokes access
- [ ] 23 Statement checking: read agency statements, check deductions and commission against each job
- [ ] 24 Email in without Gmail review: a personal forwarding address per user, plus an upload page
- [ ] 25 Payouts (optional add-on)
- [x] 26 Matcher misses: `findMatchingJob` now matches on client + date overlap (agency only breaks ties, `end_date` coalesced), a date-less email falls back to the job that wrapped in the last 60 days, and a first sync runs oldest-first so call sheets land on the booking that preceded them. `scripts/tidy.ts` merges the duplicates an older matcher left behind
- [ ] 28 Review queue: only who/when/how-much doubts flag a job now (`worthReview`), and reasons are re-judged against the merged job on every email. Still open: let the extractor say which fields it is sure of so "status uncertain" stops appearing on every wrapped job
- [ ] 27 Deploy guard: the railway.json pre-deploy migration did not run for the 0003 deploy (cause unknown); run `scripts/migrate.mjs` from the start command too, and create the cron-sync and cron-reminders services, which don't exist yet

## Phase 2 (not in v1)

- [x] 21 Tool API over the database: list_jobs, get_job, earnings, unpaid, draft_invoice_chase
