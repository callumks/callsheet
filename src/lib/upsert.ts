// Step 5. Matches an extraction to an existing job (thread id first, then
// agency + client + date overlap), writes the record, and queues pushes.

import { and, desc, eq, gte, ilike, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db as defaultDb, type Db, type Dbx } from "@/db";
import {
  invoices,
  jobs,
  reminders,
  travel,
  type Email,
  type Invoice,
  type Job,
  type NewJob,
  type Travel,
} from "@/db/schema";
import type { EmailLabel } from "./classify";
import { type Extraction, reviewReasons } from "./extract";
import { eachDay } from "./format";
import { type Change, jobChangedReminder, newBookingReminder, syncReminders } from "./reminders";

export type { Change } from "./reminders";

export type ApplyResult = {
  job: Job | null;
  created: boolean;
  changes: Change[];
  travel: Travel[];
  invoice: Invoice | null;
  reviewReasons: string[];
};

type MatchKey = {
  threadId: string;
  agency: string | null;
  client: string | null;
  startDate: string | null;
  endDate: string | null;
};

const OPEN = ["option_1", "option_2", "confirmed"] as const;

export async function findMatchingJob(db: Dbx, key: MatchKey): Promise<Job | null> {
  // 1. Same thread: strongest signal.
  const [byThread] = await db
    .select()
    .from(jobs)
    .where(eq(jobs.threadId, key.threadId))
    .orderBy(desc(jobs.updatedAt))
    .limit(1);
  if (byThread) return byThread;

  if (!key.agency && !key.client) return null;

  // 2. Same agency + client with overlapping dates.
  const nameMatch = and(
    key.agency ? ilike(jobs.agency, key.agency) : sql`true`,
    key.client ? ilike(jobs.client, key.client) : sql`true`,
  );

  if (key.startDate) {
    const end = key.endDate ?? key.startDate;
    const [byOverlap] = await db
      .select()
      .from(jobs)
      .where(and(nameMatch, lte(jobs.startDate, end), gte(jobs.endDate, key.startDate)))
      .orderBy(desc(jobs.updatedAt))
      .limit(1);
    if (byOverlap) return byOverlap;
    return null;
  }

  // 3. No dates in the email: only match if there is exactly one open job for that name.
  const open = await db
    .select()
    .from(jobs)
    .where(and(nameMatch, inArray(jobs.status, [...OPEN])))
    .limit(2);
  return open.length === 1 ? open[0] : null;
}

function jobValues(x: NonNullable<Extraction["job"]>): Partial<NewJob> {
  const v: Partial<NewJob> = {
    client: x.client,
    agency: x.agency,
    booker: x.booker,
    jobType: x.job_type,
    status: x.status ?? undefined,
    startDate: x.start_date,
    endDate: x.end_date,
    callTime: x.call_time,
    wrapTime: x.wrap_time,
    location: x.location,
    timezone: x.timezone,
    dayRate: x.day_rate === null ? null : String(x.day_rate),
    currency: x.currency,
    usage: x.usage,
    notes: x.notes,
  };
  // Only non-null incoming values ever overwrite; null means "not stated".
  for (const k of Object.keys(v) as (keyof NewJob)[]) {
    if (v[k] === null || v[k] === undefined) delete v[k];
  }
  return v;
}

const DIFF_FIELDS = [
  "client", "agency", "booker", "jobType", "status", "startDate", "endDate", "callTime",
  "wrapTime", "location", "timezone", "dayRate", "currency", "usage", "notes",
] as const;

function norm(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return /^\d{2}:\d{2}:\d{2}$/.test(s) ? s.slice(0, 5) : s;
}

/**
 * Changes between the stored job and the incoming values. Case-only and
 * numeric-equal differences are noise: they are dropped from `after` so the
 * stored spelling survives.
 */
export function diffJob(before: Job, after: Partial<NewJob>): Change[] {
  const out: Change[] = [];
  for (const f of DIFF_FIELDS) {
    if (!(f in after)) continue;
    const a = norm(before[f]);
    const b = norm(after[f]);
    const same =
      a === b ||
      (f === "dayRate" && a !== null && b !== null && Number(a) === Number(b)) ||
      (a !== null && b !== null && a.trim().toLowerCase() === b.trim().toLowerCase());
    if (same) {
      delete after[f];
      continue;
    }
    out.push({ field: f, from: a, to: b });
  }
  return out;
}

async function ensureInvoice(db: Dbx, job: Job): Promise<Invoice | null> {
  const [existing] = await db.select().from(invoices).where(eq(invoices.jobId, job.id)).limit(1);
  if (existing) return existing;
  if (job.status !== "confirmed" && job.status !== "wrapped") return null;
  const days = job.startDate ? eachDay(job.startDate, job.endDate).length : 1;
  const amount = job.dayRate ? String(Number(job.dayRate) * days) : null;
  const [inv] = await db
    .insert(invoices)
    .values({ jobId: job.id, amount, currency: job.currency, status: "to_invoice" })
    .returning();
  return inv;
}

export async function applyExtraction(
  input: { email: Email; label: EmailLabel; extraction: Extraction; now?: Date },
  db: Db = defaultDb,
): Promise<ApplyResult> {
  const { email, label, extraction: x } = input;
  const now = input.now ?? new Date();
  const reasons = reviewReasons(x);

  return db.transaction(async (tx) => {
    let job: Job | null = null;
    let created = false;
    let changes: Change[] = [];

    const key: MatchKey = {
      threadId: email.threadId,
      agency: x.job?.agency ?? null,
      client: x.job?.client ?? null,
      startDate: x.job?.start_date ?? null,
      endDate: x.job?.end_date ?? null,
    };
    const existing = await findMatchingJob(tx, key);

    if (x.job) {
      const values = jobValues(x.job);
      if (existing) {
        changes = diffJob(existing, values);
        const [updated] = await tx
          .update(jobs)
          .set({
            ...values,
            threadId: existing.threadId ?? email.threadId,
            needsReview: existing.needsReview || reasons.length > 0,
            reviewReason: reasons.length ? reasons.join("; ") : existing.reviewReason,
            updatedAt: now,
          })
          .where(eq(jobs.id, existing.id))
          .returning();
        job = updated;
      } else {
        const [inserted] = await tx
          .insert(jobs)
          .values({
            ...values,
            status: values.status ?? (label === "update" ? "confirmed" : "option_1"),
            threadId: email.threadId,
            sourceEmailId: email.id,
            needsReview: reasons.length > 0,
            reviewReason: reasons.length ? reasons.join("; ") : null,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        job = inserted;
        created = true;
      }
    } else {
      job = existing;
    }

    // Travel rows. Linked to the job when one matched, otherwise standalone.
    const travelRows: Travel[] = [];
    for (const t of x.travel) {
      const dup = t.reference
        ? await tx
            .select()
            .from(travel)
            .where(and(eq(travel.kind, t.kind), eq(travel.reference, t.reference)))
            .limit(1)
        : [];
      if (dup.length) {
        travelRows.push(dup[0]);
        continue;
      }
      const [row] = await tx
        .insert(travel)
        .values({
          jobId: job?.id ?? null,
          kind: t.kind,
          from: t.from,
          to: t.to,
          departAt: t.depart_at ? new Date(t.depart_at) : null,
          arriveAt: t.arrive_at ? new Date(t.arrive_at) : null,
          reference: t.reference,
          threadId: email.threadId,
          sourceEmailId: email.id,
          createdAt: now,
        })
        .returning();
      travelRows.push(row);
    }

    // Invoice: created on confirmation, updated by payment mail.
    let invoice: Invoice | null = job ? await ensureInvoice(tx, job) : null;
    if (x.payment && job) {
      const p = x.payment;
      const rank = { to_invoice: 0, invoiced: 1, paid: 2 } as const;
      const status = p.status && (!invoice || rank[p.status] >= rank[invoice.status]) ? p.status : undefined;
      const set = {
        amount: p.amount !== null ? String(p.amount) : undefined,
        currency: p.currency ?? undefined,
        sentAt: p.sent_at ? new Date(`${p.sent_at}T12:00:00Z`) : undefined,
        dueAt: p.due_at ? new Date(`${p.due_at}T12:00:00Z`) : undefined,
        paidAt: p.paid_at ? new Date(`${p.paid_at}T12:00:00Z`) : status === "paid" ? now : undefined,
        status,
        sourceEmailId: email.id,
      };
      if (invoice) {
        [invoice] = await tx.update(invoices).set(set).where(eq(invoices.id, invoice.id)).returning();
      } else {
        [invoice] = await tx
          .insert(invoices)
          .values({ jobId: job.id, ...set, status: set.status ?? "to_invoice", createdAt: now })
          .returning();
      }
    }

    // Pushes: immediate for new / changed, scheduled for the rest.
    if (job) {
      if (created) {
        await tx.insert(reminders).values(newBookingReminder(job, now));
      } else if (changes.length) {
        await tx.insert(reminders).values(jobChangedReminder(job, changes, now));
      }
      const travelLines = (
        await tx.select().from(travel).where(eq(travel.jobId, job.id))
      ).map(describeTravel);
      await syncReminders(tx, job, {
        now,
        travelLines,
        invoiced: !!invoice && invoice.status !== "to_invoice",
      });
    }

    return { job, created, changes, travel: travelRows, invoice, reviewReasons: reasons };
  });
}

export function describeTravel(t: Travel): string {
  const when = t.departAt ? t.departAt.toISOString().slice(11, 16) : "";
  const route = [t.from, t.to].filter(Boolean).join(" → ");
  return [t.kind, route, when, t.reference].filter(Boolean).join(" · ");
}

/** Jobs that have wrapped but are still marked confirmed: flip them. */
export async function wrapFinishedJobs(db: Db = defaultDb, today = new Date().toISOString().slice(0, 10)): Promise<number> {
  const rows = await db
    .update(jobs)
    .set({ status: "wrapped", updatedAt: new Date() })
    .where(and(eq(jobs.status, "confirmed"), or(lte(jobs.endDate, today), and(isNull(jobs.endDate), lte(jobs.startDate, today)))))
    .returning({ id: jobs.id });
  return rows.length;
}

export { ne };
