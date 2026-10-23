// Phase 2 tool surface. Read-only over the database; the agent never touches
// Gmail and never writes. draft_invoice_chase returns text for me to send.

import { and, asc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { z } from "zod";
import { db as defaultDb, type Dbx } from "@/db";
import { invoices, jobs, travel, type Invoice, type Job } from "@/db/schema";
import { eachDay, formatDay, formatMoney, formatRange, formatTime, jobName } from "./format";
import { invoiceView } from "./queries";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const toolSchemas = {
  list_jobs: z.object({ from: isoDate, to: isoDate }),
  get_job: z.object({ id: z.string().uuid() }),
  earnings: z.object({ from: isoDate, to: isoDate }),
  unpaid: z.object({}),
  draft_invoice_chase: z.object({ job_id: z.string().uuid() }),
} as const;
export type ToolName = keyof typeof toolSchemas;

function jobSummary(j: Job) {
  return {
    id: j.id,
    name: jobName(j),
    client: j.client,
    agency: j.agency,
    booker: j.booker,
    status: j.status,
    dates: formatRange(j.startDate, j.endDate),
    start_date: j.startDate,
    end_date: j.endDate,
    call_time: j.callTime ? formatTime(j.callTime) : null,
    location: j.location,
    day_rate: j.dayRate ? Number(j.dayRate) : null,
    currency: j.currency,
    needs_review: j.needsReview,
  };
}

function invoiceSummary(inv: Invoice | null, now: Date) {
  if (!inv) return null;
  return {
    status: invoiceView(inv, now),
    amount: inv.amount ? Number(inv.amount) : null,
    currency: inv.currency,
    sent_at: inv.sentAt?.toISOString().slice(0, 10) ?? null,
    due_at: inv.dueAt?.toISOString().slice(0, 10) ?? null,
    paid_at: inv.paidAt?.toISOString().slice(0, 10) ?? null,
  };
}

export async function runTool(name: ToolName, rawArgs: unknown, opts: { db?: Dbx; now?: Date } = {}) {
  const db = opts.db ?? defaultDb;
  const now = opts.now ?? new Date();
  const today = now.toISOString().slice(0, 10);

  switch (name) {
    case "list_jobs": {
      const a = toolSchemas.list_jobs.parse(rawArgs);
      const rows = await db
        .select()
        .from(jobs)
        .where(and(lte(jobs.startDate, a.to), gte(jobs.endDate, a.from)))
        .orderBy(asc(jobs.startDate), asc(jobs.callTime));
      return { jobs: rows.map(jobSummary) };
    }
    case "get_job": {
      const a = toolSchemas.get_job.parse(rawArgs);
      const [job] = await db.select().from(jobs).where(eq(jobs.id, a.id));
      if (!job) return { error: "not found" };
      const [inv] = await db.select().from(invoices).where(eq(invoices.jobId, job.id));
      const trips = await db.select().from(travel).where(eq(travel.jobId, job.id)).orderBy(asc(travel.departAt));
      return {
        job: { ...jobSummary(job), wrap_time: job.wrapTime ? formatTime(job.wrapTime) : null, usage: job.usage, notes: job.notes, timezone: job.timezone },
        invoice: invoiceSummary(inv ?? null, now),
        travel: trips.map((t) => ({ kind: t.kind, from: t.from, to: t.to, depart_at: t.departAt?.toISOString() ?? null, reference: t.reference })),
      };
    }
    case "earnings": {
      const a = toolSchemas.earnings.parse(rawArgs);
      const rows = await db
        .select({ job: jobs, invoice: invoices })
        .from(invoices)
        .innerJoin(jobs, eq(jobs.id, invoices.jobId))
        .where(and(isNotNull(jobs.startDate), gte(jobs.startDate, a.from), lte(jobs.startDate, a.to)));
      const totals: Record<string, { total: number; paid: number; invoiced: number; to_invoice: number; overdue: number; jobs: number; days: number }> = {};
      for (const { job, invoice } of rows) {
        if (job.status === "cancelled" && invoice.status === "to_invoice") continue;
        const c = invoice.currency ?? job.currency ?? "GBP";
        const t = (totals[c] ??= { total: 0, paid: 0, invoiced: 0, to_invoice: 0, overdue: 0, jobs: 0, days: 0 });
        const amt = Number(invoice.amount ?? 0);
        const v = invoiceView(invoice, now)!;
        t.total += amt;
        t[v === "overdue" ? "invoiced" : v] += amt;
        if (v === "overdue") t.overdue += amt;
        t.jobs += 1;
        t.days += job.startDate ? eachDay(job.startDate, job.endDate).length : 0;
      }
      return { from: a.from, to: a.to, by_currency: totals };
    }
    case "unpaid": {
      toolSchemas.unpaid.parse(rawArgs ?? {});
      const rows = await db
        .select({ job: jobs, invoice: invoices })
        .from(invoices)
        .innerJoin(jobs, eq(jobs.id, invoices.jobId))
        .where(and(inArray(invoices.status, ["to_invoice", "invoiced"]), inArray(jobs.status, ["confirmed", "wrapped"]), lte(jobs.startDate, today)))
        .orderBy(asc(jobs.startDate));
      return { unpaid: rows.map(({ job, invoice }) => ({ ...jobSummary(job), invoice: invoiceSummary(invoice, now) })) };
    }
    case "draft_invoice_chase": {
      const a = toolSchemas.draft_invoice_chase.parse(rawArgs);
      const [row] = await db
        .select({ job: jobs, invoice: invoices })
        .from(jobs)
        .leftJoin(invoices, eq(invoices.jobId, jobs.id))
        .where(eq(jobs.id, a.job_id));
      if (!row) return { error: "not found" };
      return { draft: draftChase(row.job, row.invoice, now), note: "Draft only. Nothing was sent." };
    }
  }
}

export function draftChase(job: Job, inv: Invoice | null, now: Date) {
  const greeting = job.booker ? `Hi ${job.booker.split(" ")[0]},` : "Hi,";
  const what = `${jobName(job)} on ${formatRange(job.startDate, job.endDate)}`;
  const amount = inv?.amount ? formatMoney(inv.amount, inv.currency ?? job.currency) : null;
  const view = invoiceView(inv, now);
  let ask: string;
  if (!inv || view === "to_invoice") {
    ask = `Could you let me know who I should invoice for ${what}${amount ? ` (${amount})` : ""}, and any PO or reference I should include?`;
  } else if (view === "overdue" && inv.dueAt) {
    const days = Math.floor((now.getTime() - inv.dueAt.getTime()) / 86_400_000);
    ask = `Just following up on my invoice for ${what}${amount ? ` (${amount})` : ""}. It was due on ${formatDay(inv.dueAt.toISOString().slice(0, 10))}, ${days} day${days === 1 ? "" : "s"} ago. Could you check where it is with the client and let me know when to expect payment?`;
  } else if (view === "paid") {
    ask = `I can see ${what} has been paid, thank you.`;
  } else {
    ask = `Just checking my invoice for ${what}${amount ? ` (${amount})` : ""} reached the right person${inv.dueAt ? ` ahead of the ${formatDay(inv.dueAt.toISOString().slice(0, 10))} due date` : ""}.`;
  }
  return {
    subject: `Invoice: ${what}`,
    body: `${greeting}\n\n${ask}\n\nThanks!`,
  };
}

/** Tool definitions in Anthropic's tool format, for whichever runtime hosts the agent. */
export const toolDefinitions = [
  { name: "list_jobs", description: "Jobs overlapping a date range, ordered by start date.", input_schema: { type: "object", properties: { from: { type: "string", description: "YYYY-MM-DD" }, to: { type: "string", description: "YYYY-MM-DD" } }, required: ["from", "to"], additionalProperties: false } },
  { name: "get_job", description: "One job with its invoice and travel.", input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false } },
  { name: "earnings", description: "Invoice totals by currency for jobs starting in a date range, split into paid, invoiced, to_invoice and overdue. Currencies are not converted.", input_schema: { type: "object", properties: { from: { type: "string" }, to: { type: "string" } }, required: ["from", "to"], additionalProperties: false } },
  { name: "unpaid", description: "Every worked job not yet paid, with invoice status.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "draft_invoice_chase", description: "Drafts an email chasing payment for a job. Returns text only; never sends.", input_schema: { type: "object", properties: { job_id: { type: "string" } }, required: ["job_id"], additionalProperties: false } },
] as const;
