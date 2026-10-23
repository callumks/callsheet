# Callsheet

Reads booking emails, turns each job into a structured record, and sends a push before I'm due on set.

A booking email lands in Gmail. Within 15 minutes it shows up in the app with the right date, call time, location and rate. I get a push the night before, and I can see what's unpaid at a glance.

Single user, installable PWA, no agent in the pipeline. Full spec in [docs/SPEC.md](docs/SPEC.md).

## How it works

```
Gmail (read-only) ─▶ fetch ─▶ filter ─▶ classify ─▶ extract ─▶ upsert ─▶ Postgres
                                                     (LLM, strict JSON + Zod)      │
                                                                                    ▼
                                           PWA (Upcoming · Job · Earnings) ◀── web push
```

- **Fetch** runs on a 15-minute cron against the Gmail history API.
- **Filter** keeps mail from known agency domains or with booking words in the subject. Nothing else is read past the headers.
- **Classify** and **extract** are two LLM calls with a strict schema. Uncertain fields come back `null` and get flagged "Needs review".
- **Upsert** matches updates to existing jobs by thread id, then agency + client + date overlap.
- Email bodies are never stored. Only extracted fields and the Gmail id are kept.

## Stack

Next.js (App Router) · TypeScript · Tailwind · Postgres with Drizzle · Vercel Cron · web push via VAPID

## Running locally

```bash
pnpm install
cp .env.example .env.local   # fill in the values
pnpm db:push
pnpm dev
```

## Layout

```
src/app/        screens and route handlers
src/db/         Drizzle schema and client
src/lib/        pipeline: gmail, filter, classify, extract, upsert
fixtures/       redacted booking emails used as the extractor eval set
docs/SPEC.md    the v1 spec
```

## Status

Milestone 1 (pipeline) in progress. See the milestones in the spec.
