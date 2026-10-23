// Overdue nudges: first at due date + 1 day, then weekly until paid.
// Run from the reminders cron. At most one unsent overdue reminder per job.

import { and, desc, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { db as defaultDb, type Dbx } from "@/db";
import { invoices, jobs, reminders, type Invoice, type Job } from "@/db/schema";
import { formatMoney, jobName } from "./format";
import { DEFAULT_TIMEZONE, addDays, localInstant } from "./reminders";

const DAY = 86_400_000;

/** When the next overdue nudge should go, given the last one sent (if any). */
export function nextOverdueAt(invoice: Pick<Invoice, "dueAt">, tz: string, lastSentAt: Date | null): Date | null {
  if (!invoice.dueAt) return null;
  const dueDay = invoice.dueAt.toISOString().slice(0, 10);
  const first = localInstant(addDays(dueDay, 1), "10:00", tz);
  if (!lastSentAt) return first;
  let next = first;
  while (next <= lastSentAt) next = new Date(next.getTime() + 7 * DAY);
  return next;
}

export function overdueMessage(job: Job, invoice: Invoice, at: Date) {
  const day = (d: Date) => Date.parse(d.toISOString().slice(0, 10));
  const days = Math.max(1, Math.round((day(at) - day(invoice.dueAt!)) / DAY));
  return {
    title: `${jobName(job)} is ${days} day${days === 1 ? "" : "s"} overdue`,
    body: `${formatMoney(invoice.amount, invoice.currency ?? job.currency)} · due ${invoice.dueAt!.toISOString().slice(0, 10)}`,
  };
}

export async function scheduleOverdue(db: Dbx = defaultDb, now = new Date()): Promise<{ scheduled: number; cleared: number }> {
  // Paid or no-longer-invoiced jobs: drop any pending overdue nudge.
  const pending = await db
    .select({ r: reminders, inv: invoices })
    .from(reminders)
    .innerJoin(invoices, eq(invoices.jobId, reminders.jobId))
    .where(and(eq(reminders.kind, "overdue"), isNull(reminders.sentAt)));
  let cleared = 0;
  for (const { r, inv } of pending) {
    if (inv.status !== "invoiced") {
      await db.delete(reminders).where(eq(reminders.id, r.id));
      cleared++;
    }
  }

  // Invoiced, unpaid, and due before the next 24h window.
  const rows = await db
    .select({ job: jobs, invoice: invoices })
    .from(invoices)
    .innerJoin(jobs, eq(jobs.id, invoices.jobId))
    .where(and(eq(invoices.status, "invoiced"), isNotNull(invoices.dueAt), lt(invoices.dueAt, new Date(now.getTime() + DAY))));

  let scheduled = 0;
  for (const { job, invoice } of rows) {
    const existing = await db
      .select()
      .from(reminders)
      .where(and(eq(reminders.jobId, job.id), eq(reminders.kind, "overdue")))
      .orderBy(desc(reminders.sendAt));
    if (existing.some((r) => r.sentAt === null)) continue;
    const lastSent = existing.find((r) => r.sentAt)?.sendAt ?? null;
    let at = nextOverdueAt(invoice, job.timezone ?? DEFAULT_TIMEZONE, lastSent);
    if (!at) continue;
    // Catch up after downtime: never schedule further in the past than now.
    while (at.getTime() + 7 * DAY <= now.getTime()) at = new Date(at.getTime() + 7 * DAY);
    const msg = overdueMessage(job, invoice, at);
    await db.insert(reminders).values({ jobId: job.id, kind: "overdue", sendAt: at, url: `/jobs/${job.id}`, ...msg });
    scheduled++;
  }
  return { scheduled, cleared };
}
