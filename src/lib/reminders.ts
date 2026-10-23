// Reminder planning. Everything is computed in the job's own time zone and
// stored as an absolute instant. The cron just sends whatever is due.

import { TZDate } from "@date-fns/tz";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Dbx } from "@/db";
import { reminders, type Job, type NewReminder } from "@/db/schema";
import { eachDay, formatDay, formatMoney, formatTime, jobName } from "./format";

export type Change = { field: string; from: string | null; to: string | null };

export const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE ?? "Europe/London";

/** Local wall-clock in `tz` → absolute Date. */
export function localInstant(day: string, hhmm: string, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, h, min, 0, tz).getTime());
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

const SCHEDULED_KINDS = ["night_before", "call_time", "invoice_due"] as const;

export type PlanOpts = {
  now?: Date;
  /** Lines describing travel for the night-before push. */
  travelLines?: string[];
  /** True when an invoice for this job is already invoiced or paid. */
  invoiced?: boolean;
};

/** The scheduled reminders a job should have right now. */
export function planReminders(job: Job, opts: PlanOpts = {}): NewReminder[] {
  const now = opts.now ?? new Date();
  if (job.status !== "confirmed" || !job.startDate) return [];
  const tz = job.timezone ?? DEFAULT_TIMEZONE;
  const name = jobName(job);
  const url = `/jobs/${job.id}`;
  const out: NewReminder[] = [];
  const where = job.location ? ` · ${job.location}` : "";

  for (const day of eachDay(job.startDate, job.endDate)) {
    const call = job.callTime ? formatTime(job.callTime) : null;
    out.push({
      jobId: job.id,
      kind: "night_before",
      sendAt: localInstant(addDays(day, -1), "20:00", tz),
      title: `Tomorrow: ${name}`,
      body: [`Call ${call ?? "TBC"}${where}`, ...(opts.travelLines ?? [])].join("\n"),
      url,
    });
    if (call) {
      out.push({
        jobId: job.id,
        kind: "call_time",
        sendAt: new Date(localInstant(day, call, tz).getTime() - 2 * 3_600_000),
        title: `${name} · call ${call}`,
        body: job.location ?? "Call in 2 hours",
        url,
      });
    }
  }

  if (!opts.invoiced) {
    const end = job.endDate ?? job.startDate;
    out.push({
      jobId: job.id,
      kind: "invoice_due",
      sendAt: localInstant(addDays(end, 1), "10:00", tz),
      title: `Invoice ${name}?`,
      body: `Wrapped ${formatDay(end)}${job.dayRate ? ` · ${formatMoney(job.dayRate, job.currency)}/day` : ""}`,
      url,
    });
  }

  return out.filter((r) => r.sendAt > now);
}

/** Replace the unsent scheduled reminders for a job with a fresh plan. */
export async function syncReminders(db: Dbx, job: Job, opts: PlanOpts = {}): Promise<NewReminder[]> {
  await db
    .delete(reminders)
    .where(and(eq(reminders.jobId, job.id), isNull(reminders.sentAt), inArray(reminders.kind, [...SCHEDULED_KINDS])));
  const plan = planReminders(job, opts);
  if (plan.length) await db.insert(reminders).values(plan);
  return plan;
}

// --- Immediate pushes ------------------------------------------------------

export function newBookingReminder(job: Job, now = new Date()): NewReminder {
  const name = jobName(job);
  const when = formatDay(job.startDate);
  const call = job.callTime ? `, call ${formatTime(job.callTime)}` : "";
  const lead =
    job.status === "confirmed" ? "Booked" : job.status === "option_2" ? "2nd option" : job.status === "option_1" ? "1st option" : "New";
  return {
    jobId: job.id,
    kind: "new_booking",
    sendAt: now,
    title: `${lead}: ${name}`,
    body: `${when}${call}`,
    url: `/jobs/${job.id}`,
  };
}

const FIELD_LABEL: Record<string, string> = {
  status: "status",
  startDate: "date",
  endDate: "end date",
  callTime: "call time",
  wrapTime: "wrap",
  location: "location",
  dayRate: "rate",
  currency: "currency",
  usage: "usage",
  client: "client",
  booker: "booker",
  jobType: "type",
  notes: "notes",
  timezone: "time zone",
};

export function describeChange(c: Change): string {
  const label = FIELD_LABEL[c.field] ?? c.field;
  const fmt = (v: string | null) => {
    if (v === null) return "—";
    if (c.field === "startDate" || c.field === "endDate") return formatDay(v);
    if (c.field === "callTime" || c.field === "wrapTime") return formatTime(v);
    return v;
  };
  return `${label} ${fmt(c.from)} → ${fmt(c.to)}`;
}

export function jobChangedReminder(job: Job, changes: Change[], now = new Date()): NewReminder {
  return {
    jobId: job.id,
    kind: "job_changed",
    sendAt: now,
    title: `${jobName(job)} changed`,
    body: changes.map(describeChange).join("\n"),
    url: `/jobs/${job.id}`,
  };
}
