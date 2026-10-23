# Callsheet — v1 spec

Oct 22, 2026 · Callum

## Overview

Callsheet reads my booking emails, turns each job into a structured record, and reminds me before I'm due on set. One user, me. It also has to be a polished, non-crypto portfolio piece that shows full-stack and UI range.

**Problem:** Agency jobs, options, travel and pay arrive by email and I never log them. I lose track of what I worked, when, and what I'm owed.

**Done looks like:** A booking email lands, and within 15 minutes it shows up in the app with the right date, call time, location and rate. I get a push the night before, and I can see what's unpaid at a glance.

## Scope

v1 is one pipeline and three screens. Everything else waits.

| | In v1 | Out of v1 |
|---|---|---|
| Data in | Gmail, read-only, my account only | Other inboxes, WhatsApp, PDFs of call sheets |
| Records | Jobs, options, travel, invoice status | Expenses, tax exports |
| Alerts | Web push to my phone | SMS, email digests |
| UI | Upcoming, Job detail, Earnings | Calendar view, search, settings beyond basics |
| Agent | None | Chat agent over my data (phase 2) |
| Users | Me | Anyone else; no Google verification needed |

## Data model

Four Postgres tables. Every record keeps a link back to the email it came from, so any field can be checked against the source.

| Table | Key fields | Notes |
|---|---|---|
| `emails` | gmail_id, thread_id, from, subject, received_at, classified_as, processed_at | Raw metadata only; body fetched on demand, never stored |
| `jobs` | id, client, agency, booker, job_type, status (option_1 / option_2 / confirmed / cancelled / wrapped), start_date, end_date, call_time, wrap_time, location, day_rate, currency, usage, source_email_id | A multi-day job is one row with a date range |
| `travel` | id, job_id?, kind (flight / hotel / car), from, to, depart_at, arrive_at, reference, source_email_id | job_id optional; a trip can stand alone |
| `invoices` | id, job_id, amount, currency, sent_at, due_at, paid_at, status (to_invoice / invoiced / paid / overdue) | overdue is derived from due_at, not set by hand |

An update email (option to confirmed, call time moved) changes the existing job rather than creating a new one. Matching is on agency + client + date overlap, with the thread id as the strongest signal.

## Extraction pipeline

A cron job does the extraction deterministically, with no agent involved. It runs in five steps:

1. **Fetch.** Every 15 minutes, pull new message ids since the last historyId via the Gmail API, scope `gmail.readonly`.
2. **Filter.** Keep messages from known agency domains, plus anything whose subject matches booking words (confirmed, option, booking, call sheet, flight, itinerary). Everything else is skipped and never read past the headers.
3. **Classify.** One cheap LLM call labels the email: `new_booking`, `update`, `travel`, `payment`, or `irrelevant`.
4. **Extract.** For relevant emails, one LLM call with a strict JSON schema (structured output) returns the fields. Validate it with Zod. Any field it isn't sure about comes back null instead of being guessed.
5. **Upsert.** Match against existing jobs (see Data model), write the record, and schedule its reminders.

If a record has a null field or low confidence, it's flagged "Needs review" in the app, and I fix it with one tap. A fixtures folder of 20+ real (redacted) booking emails acts as the eval set; the extractor can't regress against it.

## Notifications and reminders

Web push to the installed PWA, sent from a scheduled reminders table, all in the job's local time zone.

| Trigger | When | Message |
|---|---|---|
| New booking parsed | Immediately | "Booked: Northbound, Mon 27 Oct, call 07:00" |
| Job changed | Immediately | What changed, old → new |
| Night before | 20:00 the evening before | Call time, location, travel |
| Call time | 2h before call | Call time, location |
| Invoice due | Day after a job wraps, if not marked invoiced | "Invoice Northbound?" |
| Overdue | Due date + 1 day, then weekly | Amount, days overdue |

Note: on iOS, web push only works once the PWA is added to the home screen (iOS 16.4+).

## Agent layer (phase 2)

The agent goes on top of the database, not inside the pipeline. It can read my data and suggest actions; it never touches Gmail directly and never writes without my OK.

- Interface: chat over Telegram (or iMessage), plus an Ask box in the app.
- Tools exposed: `list_jobs(range)`, `get_job(id)`, `earnings(period)`, `unpaid()`, `draft_invoice_chase(job_id)`, which returns a draft only.
- Example asks: "Where's my call tomorrow?" · "What am I owed?" · "How much did I make in Q3?" · "Chase Studio Halden."
- Runtime: either Hermes Agent (Nous Research) or my own OpenClaw. The tool surface is the same, so the choice can wait until phase 2.

## UI

Three screens, mobile-first. It's an installable PWA, so there's no App Store. The design is the current Callsheet canvas.

| Screen | Shows | Actions |
|---|---|---|
| Upcoming | Next job as a hero card, then a 14-day list: date, client, a status dot | Tap through to the job; pull to resync |
| Job detail | Dates, call, wrap, rate, location, booker, usage, reminders, link to the source email | Edit any field, mark as invoiced or paid |
| Earnings | Month total, a paid / invoiced / to-invoice bar, 6-month bars, the unpaid list | Tap through to the job; mark as paid |

**Direction:** white ground with one ink colour and one accent. Geist for text; Geist Mono only for times and money. Status is shown as a dot (solid for confirmed, outline for a 1st option, dashed for a 2nd), not a pill. Navigation is a floating pill. No borders where spacing does the job. Dark mode follows the system setting.

**Stack:** Next.js (App Router) + TypeScript, Tailwind, Postgres on Supabase or Neon with Drizzle, cron through Vercel Cron or Inngest, web push via VAPID.

## Security and privacy

It's one user, but it reads my inbox, so it's built as if it were real.

- Use the `gmail.readonly` scope only. The OAuth app stays in Testing mode with me as the only test user.
- Encrypt the refresh token at rest, with the key in an env var, never in the repo.
- Email bodies go to the LLM for extraction only. They're never stored. Only the extracted fields and the Gmail id are kept.
- The app sits behind auth (Google sign-in, allow-list of one email). There are no public routes except the push service worker.
- The repo is public for the portfolio. Fixtures are redacted, and a seed script fills a demo account with fake data for screenshots.

## Milestones

The build runs in order, and each phase ends on something I can actually use.

1. **Pipeline.** Gmail OAuth, fetch, filter, classify, extract, upsert. Done when 20 fixture emails extract correctly and real bookings land in the database.
2. **Screens.** Upcoming, Job detail and Earnings, wired to real data with inline field edits. Done when I use it instead of my notes for a week.
3. **Reminders.** Web push, the reminders table, and invoice nudges. Done when I get the night-before push for a real job.
4. **Polish and ship.** Dark mode, empty and loading states, the demo seed, README with screenshots, and a short Loom. Done when it's on my portfolio.
5. **Agent.** Tool API over the database, plus a Telegram bot on Hermes or OpenClaw.

## Open questions

- [ ] Which agency domains go on the allow-list to start?
- [ ] Currency: do jobs pay in USD, GBP, or both? Do totals need converting?
- [ ] Does the rate in emails mean per day, per job, or both? Is a usage fee separate?
- [ ] Which LLM for extraction? Pick on cost per email against the fixture accuracy.
- [ ] Should cancelled jobs stay visible in Earnings, for kill fees?
