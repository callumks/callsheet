// Prints the YC numbers straight from the ledger.
// Usage: pnpm tsx scripts/numbers.ts
import "./env";

import { sql } from "drizzle-orm";
import { db } from "../src/db";

const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as Record<string, unknown>[];

async function main() {
  console.log("\nOwed right now (invoices not paid), by currency:");
  console.table(
    await rows(sql`
      select coalesce(i.currency, j.currency, '?') as currency,
             count(*)::int as invoices,
             count(*) filter (where i.amount is null)::int as missing_amount,
             sum(i.amount)::numeric(12,2) as total,
             count(*) filter (where i.due_at < now())::int as overdue,
             sum(i.amount) filter (where i.due_at < now())::numeric(12,2) as overdue_total
      from invoices i join jobs j on j.id = i.job_id
      where i.status <> 'paid' and j.status <> 'cancelled'
      group by 1 order by 1`),
  );

  console.log("\nWrapped jobs with no invoice row at all (work done, nothing chased):");
  console.table(
    await rows(sql`
      select count(*)::int as jobs,
             coalesce(currency, '?') as currency,
             sum(day_rate * (coalesce(end_date, start_date) - start_date + 1))::numeric(12,2) as est_value_at_day_rate
      from jobs j
      where status = 'wrapped' and not exists (select 1 from invoices i where i.job_id = j.id)
      group by 2`),
  );

  console.log("\nDays from job end to payment (paid invoices):");
  console.table(
    await rows(sql`
      select count(*)::int as paid_invoices,
             round(avg(extract(epoch from (i.paid_at - coalesce(j.end_date, j.start_date)::timestamptz)) / 86400))::int as avg_days,
             percentile_disc(0.5) within group (order by (i.paid_at::date - coalesce(j.end_date, j.start_date))) as median_days,
             max(i.paid_at::date - coalesce(j.end_date, j.start_date)) as worst_days
      from invoices i join jobs j on j.id = i.job_id
      where i.status = 'paid' and i.paid_at is not null and coalesce(j.end_date, j.start_date) is not null`),
  );

  console.log("\nCoverage:");
  console.table(
    await rows(sql`
      select (select count(*) from jobs)::int as jobs,
             (select count(*) from invoices)::int as invoices,
             (select count(*) from emails)::int as emails_seen,
             (select min(received_at)::date from emails) as oldest_email,
             (select count(*) from jobs where needs_review)::int as jobs_needing_review`),
  );
  process.exit(0);
}

main();
