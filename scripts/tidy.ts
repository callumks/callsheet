// Tidies a ledger after a backfill or a matcher fix: merges duplicate jobs
// (same client, overlapping dates), re-judges which jobs still need review,
// fills invoice amounts a late rate made computable, and drops queued pushes
// about old news. Safe to run again; it only changes what is still wrong.
// Usage: pnpm tsx scripts/tidy.ts [--dry]
import "./env";
import { and, asc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "../src/db";
import { expenses, invoices, jobs, reminders, travel, type Job } from "../src/db/schema";
import { REQUIRED_JOB_FIELDS, worthReview } from "../src/lib/extract";

const dry = process.argv.includes("--dry");

const RANK: Record<Job["status"], number> = { option_1: 0, option_2: 1, cancelled: 2, confirmed: 3, wrapped: 4 };
const nameKey = (col: unknown) =>
  sql`regexp_replace(lower(${col}), '\\m(inc|ltd|llc|limited|corp|co|gmbh|plc)\\M|[^a-z0-9]+', '', 'g')`;

const MERGE_FIELDS = [
  "agency", "booker", "jobType", "startDate", "endDate", "callTime", "wrapTime", "location",
  "timezone", "dayRate", "currency", "usage", "sourceEmailId", "threadId",
] as const;

/** The pair of overlapping same-client jobs with the oldest base, or null. */
async function nextPair(): Promise<[Job, Job] | null> {
  const a = sql`jobs`;
  const rows = (await db.execute(sql`
    select a.id as a, b.id as b
    from ${a} as a join ${a} as b on b.user_id = a.user_id and a.id <> b.id
    where ${nameKey(sql`a.client`)} = ${nameKey(sql`b.client`)}
      and a.start_date is not null and b.start_date is not null
      and a.start_date <= coalesce(b.end_date, b.start_date)
      and coalesce(a.end_date, a.start_date) >= b.start_date
    order by a.created_at, b.created_at limit 1`)) as unknown as { a: string; b: string }[];
  if (!rows.length) return null;
  const pair = await db.select().from(jobs).where(inArray(jobs.id, [rows[0].a, rows[0].b]));
  // The stronger status is the base; a confirmation outranks the call sheet that followed it.
  pair.sort((x, y) => RANK[y.status] - RANK[x.status] || x.createdAt.getTime() - y.createdAt.getTime());
  return [pair[0], pair[1]];
}

async function mergeDuplicates(): Promise<number> {
  let merged = 0;
  for (let pair = await nextPair(); pair; pair = await nextPair()) {
    const [keep, drop] = pair;
    const set: Partial<Job> = {};
    for (const f of MERGE_FIELDS) if (keep[f] === null && drop[f] !== null) (set as Record<string, unknown>)[f] = drop[f];
    if (drop.notes && drop.notes !== keep.notes) set.notes = keep.notes ? `${keep.notes}\n${drop.notes}` : drop.notes;
    console.log(`merge ${drop.client} ${drop.startDate} (${drop.status}) into ${keep.startDate} (${keep.status}); fills ${Object.keys(set).join(", ") || "nothing"}`);
    if (dry) break;
    await db.transaction(async (tx) => {
      await tx.update(jobs).set({ ...set, updatedAt: new Date() }).where(eq(jobs.id, keep.id));
      await tx.update(travel).set({ jobId: keep.id }).where(eq(travel.jobId, drop.id));
      await tx.update(expenses).set({ jobId: keep.id }).where(eq(expenses.jobId, drop.id));
      const [mine] = await tx.select().from(invoices).where(eq(invoices.jobId, keep.id)).limit(1);
      const [theirs] = await tx.select().from(invoices).where(eq(invoices.jobId, drop.id)).limit(1);
      if (theirs && !mine) await tx.update(invoices).set({ jobId: keep.id }).where(eq(invoices.id, theirs.id));
      else if (theirs && mine) {
        // Keep the one that knows more: a paid or sent invoice, else an amount.
        const rank = { to_invoice: 0, invoiced: 1, paid: 2 };
        const better = rank[theirs.status] > rank[mine.status] || (rank[theirs.status] === rank[mine.status] && mine.amount === null && theirs.amount !== null);
        if (better) {
          await tx.delete(invoices).where(eq(invoices.id, mine.id));
          await tx.update(invoices).set({ jobId: keep.id }).where(eq(invoices.id, theirs.id));
        }
      }
      await tx.delete(jobs).where(eq(jobs.id, drop.id)); // its reminders and remaining invoice cascade
    });
    merged++;
  }
  return merged;
}

/** Re-judge every flagged job against what it holds now and the current review rules. */
async function rejudge(): Promise<number> {
  const flagged = await db.select().from(jobs).where(eq(jobs.needsReview, true)).orderBy(asc(jobs.createdAt));
  const present: Record<(typeof REQUIRED_JOB_FIELDS)[number], (j: Job) => unknown> = {
    client: (j) => j.client,
    start_date: (j) => j.startDate,
    call_time: (j) => j.callTime,
    location: (j) => j.location,
    day_rate: (j) => j.dayRate,
  };
  let changed = 0;
  for (const j of flagged) {
    const reasons = worthReview(
      (j.reviewReason ?? "")
        .split("; ")
        .filter(Boolean)
        .map((r) => r.replace(/^job\./, ""))
        .filter((r) => {
          const m = r.match(/^(\w+) missing$/);
          return !m || !(m[1] in present) || present[m[1] as keyof typeof present](j) === null;
        }),
    );
    const reason = reasons.length ? [...new Set(reasons)].join("; ") : null;
    const needs = reasons.length > 0;
    if (needs === j.needsReview && reason === j.reviewReason) continue;
    changed++;
    if (!dry) await db.update(jobs).set({ needsReview: needs, reviewReason: reason }).where(eq(jobs.id, j.id));
  }
  return changed;
}

/** An invoice created before the rate arrived has no amount; it is rate × days. */
async function fillInvoiceAmounts(): Promise<number> {
  if (dry) {
    const [{ n }] = (await db.execute(sql`select count(*)::int n from invoices i join jobs j on j.id = i.job_id where i.amount is null and j.day_rate is not null and j.start_date is not null and i.status = 'to_invoice'`)) as unknown as { n: number }[];
    return n;
  }
  const rows = await db.execute(sql`
    update invoices i set amount = j.day_rate * (coalesce(j.end_date, j.start_date) - j.start_date + 1), currency = coalesce(i.currency, j.currency)
    from jobs j where j.id = i.job_id and i.amount is null and j.day_rate is not null and j.start_date is not null and i.status = 'to_invoice'
    returning i.id`);
  return rows.length;
}

async function dropStalePushes(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 3_600_000);
  const where = and(isNull(reminders.sentAt), inArray(reminders.kind, ["new_booking", "job_changed"]), lt(reminders.sendAt, cutoff));
  if (dry) return (await db.select({ id: reminders.id }).from(reminders).where(where)).length;
  return (await db.delete(reminders).where(where).returning({ id: reminders.id })).length;
}

async function main() {
  if (dry) console.log("dry run: nothing is written\n");
  console.log(`merged ${await mergeDuplicates()} duplicate job(s)`);
  console.log(`re-judged ${await rejudge()} review flag(s)`);
  console.log(`filled ${await fillInvoiceAmounts()} invoice amount(s)`);
  console.log(`dropped ${await dropStalePushes()} stale push(es)`);
  process.exit(0);
}

main();
