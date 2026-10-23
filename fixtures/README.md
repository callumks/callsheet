# Fixtures

Synthetic, fully fictional booking emails used as the extractor's eval set.
No real agencies, clients or people. The extractor can't regress against them.

Each fixture is a pair:

- `NNN-slug.txt` — the email. Four header lines, a blank line, then the body
  exactly as the pipeline would see it after `bodyText()` (plain text, quoted
  threads and HTML remnants included where realistic):

  ```
  From: Jo Booker <jo@northagency.example>
  Subject: 1st option – Northbound e-comm – Mon 27 Oct
  Date: 2026-10-20T09:12:00Z
  Thread: t-001

  Hi Callum, …
  ```

  `Date` is the Received instant (ISO 8601 UTC). `Thread` ties updates to the
  booking they change; reuse the id.

- `NNN-slug.expected.json` — `{ "label", "extraction" }`. `label` is the
  classify output. `extraction` is the `ExtractionSchema` object as it should
  look **after** `normalise()`: dates `YYYY-MM-DD`, times `HH:MM` padded,
  currency upper-case ISO, instants ISO UTC with `.000Z`. `null` for
  irrelevant mail. `confidence`, `changes` and `uncertain_fields` are recorded
  but not scored.

## Coverage (22)

| Label | Count | Fixtures |
|---|---|---|
| new_booking | 8 | 001, 004, 005, 006, 007, 008, 009, 010 |
| update | 5 | 002, 003, 011, 012, 013 |
| travel | 3 | 014, 015, 016 |
| payment | 3 | 017, 018, 019 |
| irrelevant | 3 | 020, 021, 022 |

Edge cases on purpose: first and second options, single and multi-day, GBP /
USD / EUR, a usage fee stated separately (006), a total for an explicit day
count (005) and for an unstated one (008), a weekday-only date (007), a
forwarded HTML thread (009), and updates that only restate what changed.

## Running the eval

```bash
pnpm tsx scripts/eval.ts              # full run, needs ANTHROPIC_API_KEY
pnpm tsx scripts/eval.ts --only 007   # one fixture
pnpm tsx scripts/eval.ts --skip-llm   # offline: parse + schema check only
```

Exit code is 1 when label accuracy drops below 0.9 or any required job field
(client, start_date, call_time, location, day_rate) scores below 0.9.
`pnpm test` runs the offline check via `scripts/eval.test.ts`.

## Adding one

1. Redact properly: swap every name, domain, address and reference. Keep the
   formatting quirks; they're the point.
2. Number it next in sequence, pick a short slug, write the four headers.
3. Write the expected JSON by hand against the rules in `EXTRACT_SYSTEM`
   (`src/lib/extract.ts`): null over guess, usage separate from day rate.
4. `pnpm tsx scripts/eval.ts --skip-llm` to check it parses and validates.
