"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { expenses, invoices, jobs, reminders, travel } from "@/db/schema";
import { validCurrency, validDate, validTime, validZone } from "@/lib/extract";
import { syncReminders } from "@/lib/reminders";
import { requireSession } from "@/lib/session";
import { describeTravel } from "@/lib/upsert";

const Status = z.enum(["option_1", "option_2", "confirmed", "cancelled", "wrapped"]);

const Field = z.enum([
  "client", "agency", "booker", "jobType", "status", "startDate", "endDate", "callTime", "wrapTime",
  "location", "timezone", "dayRate", "currency", "usage", "notes",
]);
export type EditableField = z.infer<typeof Field>;

function coerce(field: EditableField, raw: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const v = raw.trim();
  if (v === "") return { ok: true, value: null };
  switch (field) {
    case "status": {
      const r = Status.safeParse(v);
      return r.success ? { ok: true, value: r.data } : { ok: false, error: "Unknown status" };
    }
    case "startDate":
    case "endDate": {
      const d = validDate(v);
      return d ? { ok: true, value: d } : { ok: false, error: "Use YYYY-MM-DD" };
    }
    case "callTime":
    case "wrapTime": {
      const t = validTime(v);
      return t ? { ok: true, value: t } : { ok: false, error: "Use HH:MM" };
    }
    case "dayRate": {
      const n = Number(v.replace(/[^0-9.]/g, ""));
      return Number.isFinite(n) && n >= 0 ? { ok: true, value: String(n) } : { ok: false, error: "Not a number" };
    }
    case "currency": {
      const c = validCurrency(v);
      return c ? { ok: true, value: c } : { ok: false, error: "Use a 3-letter code" };
    }
    case "timezone": {
      const z = validZone(v);
      return z ? { ok: true, value: z } : { ok: false, error: "Use an IANA zone like Europe/London" };
    }
    default:
      return { ok: true, value: v };
  }
}

/** The job, if it belongs to the signed-in user. */
async function ownJob(userId: string, jobId: string) {
  const [job] = await db.select().from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.id, jobId))).limit(1);
  return job ?? null;
}

async function resync(userId: string, jobId: string) {
  const job = await ownJob(userId, jobId);
  if (!job) return;
  const [inv] = await db.select().from(invoices).where(eq(invoices.jobId, jobId)).limit(1);
  const trips = await db.select().from(travel).where(eq(travel.jobId, jobId));
  await syncReminders(db, job, { travelLines: trips.map(describeTravel), invoiced: !!inv && inv.status !== "to_invoice" });
}

function touch(jobId: string | null) {
  revalidatePath("/");
  revalidatePath("/earnings");
  revalidatePath("/review");
  if (jobId) revalidatePath(`/jobs/${jobId}`);
}

export async function updateJobField(jobId: string, field: EditableField, raw: string): Promise<{ error?: string }> {
  const { userId } = await requireSession();
  const job = await ownJob(userId, jobId);
  if (!job) return { error: "Job not found" };
  const f = Field.parse(field);
  const c = coerce(f, raw);
  if (!c.ok) return { error: c.error };
  const patch: Record<string, string | null | Date> = { [f]: c.value, updatedAt: new Date() };
  if (f === "status" && c.value === null) return { error: "Status is required" };
  if (f === "startDate" && c.value) {
    if (!job.endDate || job.endDate < c.value) patch.endDate = c.value;
  }
  await db.update(jobs).set(patch).where(eq(jobs.id, jobId));
  await resync(userId, jobId);
  touch(jobId);
  return {};
}

export async function clearReview(jobId: string) {
  const { userId } = await requireSession();
  await db
    .update(jobs)
    .set({ needsReview: false, reviewReason: null, updatedAt: new Date() })
    .where(and(eq(jobs.userId, userId), eq(jobs.id, jobId)));
  touch(jobId);
}

const TERMS_DAYS = Number(process.env.INVOICE_TERMS_DAYS ?? 30);

export async function setInvoiceStatus(jobId: string, status: "to_invoice" | "invoiced" | "paid") {
  const { userId } = await requireSession();
  const now = new Date();
  const job = await ownJob(userId, jobId);
  if (!job) return;
  const [inv] = await db.select().from(invoices).where(eq(invoices.jobId, jobId)).limit(1);
  const set = {
    status,
    sentAt: status === "invoiced" ? (inv?.sentAt ?? now) : status === "to_invoice" ? null : inv?.sentAt ?? now,
    dueAt:
      status === "invoiced"
        ? (inv?.dueAt ?? new Date(now.getTime() + TERMS_DAYS * 86_400_000))
        : status === "to_invoice"
          ? null
          : inv?.dueAt ?? null,
    paidAt: status === "paid" ? (inv?.paidAt ?? now) : null,
  };
  if (inv) {
    await db.update(invoices).set(set).where(eq(invoices.id, inv.id));
  } else {
    await db.insert(invoices).values({ userId, jobId, amount: job.dayRate, currency: job.currency, ...set });
  }
  // Paid or invoiced: no more nudges for this job.
  if (status !== "to_invoice") {
    await db.delete(reminders).where(eq(reminders.jobId, jobId));
  }
  await resync(userId, jobId);
  touch(jobId);
}

export async function setInvoiceAmount(jobId: string, raw: string): Promise<{ error?: string }> {
  const { userId } = await requireSession();
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return { error: "Not a number" };
  const job = await ownJob(userId, jobId);
  if (!job) return { error: "Job not found" };
  const [inv] = await db.select().from(invoices).where(eq(invoices.jobId, jobId)).limit(1);
  if (inv) await db.update(invoices).set({ amount: String(n) }).where(eq(invoices.id, inv.id));
  else await db.insert(invoices).values({ userId, jobId, amount: String(n), currency: job.currency });
  touch(jobId);
  return {};
}

// --- Expenses --------------------------------------------------------------

const ExpenseInput = z.object({
  kind: z.enum(["flight", "hotel", "transport", "food", "kit", "other"]),
  description: z.string().trim().max(200),
  amount: z.string(),
  reimbursable: z.boolean(),
});

export async function addExpense(jobId: string, input: z.infer<typeof ExpenseInput>): Promise<{ error?: string }> {
  const { userId } = await requireSession();
  const x = ExpenseInput.parse(input);
  const n = Number(x.amount.replace(/[^0-9.]/g, ""));
  if (!x.amount.trim() || !Number.isFinite(n) || n <= 0) return { error: "Enter an amount" };
  const job = await ownJob(userId, jobId);
  if (!job) return { error: "Job not found" };
  await db.insert(expenses).values({
    userId,
    jobId,
    kind: x.kind,
    description: x.description || null,
    amount: String(n),
    currency: job.currency,
    incurredOn: job.startDate ?? new Date().toISOString().slice(0, 10),
    reimbursable: x.reimbursable,
  });
  touch(jobId);
  return {};
}

const ownExpense = (userId: string, id: string) => and(eq(expenses.userId, userId), eq(expenses.id, id));

export async function setExpenseReimbursed(id: string, done: boolean) {
  const { userId } = await requireSession();
  const [e] = await db
    .update(expenses)
    .set({ reimbursedAt: done ? new Date() : null })
    .where(ownExpense(userId, id))
    .returning({ jobId: expenses.jobId });
  touch(e?.jobId ?? null);
}

/** Review: the expense is right as it stands. */
export async function keepExpense(id: string) {
  const { userId } = await requireSession();
  const [e] = await db
    .update(expenses)
    .set({ needsReview: false, reviewReason: null })
    .where(ownExpense(userId, id))
    .returning({ jobId: expenses.jobId });
  touch(e?.jobId ?? null);
}

/** Not a work cost, or entered by mistake. */
export async function deleteExpense(id: string) {
  const { userId } = await requireSession();
  const [e] = await db.delete(expenses).where(ownExpense(userId, id)).returning({ jobId: expenses.jobId });
  touch(e?.jobId ?? null);
}
