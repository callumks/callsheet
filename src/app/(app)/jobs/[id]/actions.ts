"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { invoices, jobs, reminders, travel } from "@/db/schema";
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

async function resync(jobId: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) return;
  const [inv] = await db.select().from(invoices).where(eq(invoices.jobId, jobId)).limit(1);
  const trips = await db.select().from(travel).where(eq(travel.jobId, jobId));
  await syncReminders(db, job, { travelLines: trips.map(describeTravel), invoiced: !!inv && inv.status !== "to_invoice" });
}

function touch(jobId: string) {
  revalidatePath("/");
  revalidatePath("/earnings");
  revalidatePath("/review");
  revalidatePath(`/jobs/${jobId}`);
}

export async function updateJobField(jobId: string, field: EditableField, raw: string): Promise<{ error?: string }> {
  await requireSession();
  const f = Field.parse(field);
  const c = coerce(f, raw);
  if (!c.ok) return { error: c.error };
  const patch: Record<string, string | null | Date> = { [f]: c.value, updatedAt: new Date() };
  if (f === "status" && c.value === null) return { error: "Status is required" };
  if (f === "startDate" && c.value) {
    const [j] = await db.select({ endDate: jobs.endDate }).from(jobs).where(eq(jobs.id, jobId));
    if (!j?.endDate || j.endDate < c.value) patch.endDate = c.value;
  }
  await db.update(jobs).set(patch).where(eq(jobs.id, jobId));
  await resync(jobId);
  touch(jobId);
  return {};
}

export async function clearReview(jobId: string) {
  await requireSession();
  await db.update(jobs).set({ needsReview: false, reviewReason: null, updatedAt: new Date() }).where(eq(jobs.id, jobId));
  touch(jobId);
}

const TERMS_DAYS = Number(process.env.INVOICE_TERMS_DAYS ?? 30);

export async function setInvoiceStatus(jobId: string, status: "to_invoice" | "invoiced" | "paid") {
  await requireSession();
  const now = new Date();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
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
    await db.insert(invoices).values({ jobId, amount: job.dayRate, currency: job.currency, ...set });
  }
  // Paid or invoiced: no more nudges for this job.
  if (status !== "to_invoice") {
    await db.delete(reminders).where(eq(reminders.jobId, jobId));
  }
  await resync(jobId);
  touch(jobId);
}

export async function setInvoiceAmount(jobId: string, raw: string): Promise<{ error?: string }> {
  await requireSession();
  const n = Number(raw.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return { error: "Not a number" };
  const [inv] = await db.select().from(invoices).where(eq(invoices.jobId, jobId)).limit(1);
  if (inv) await db.update(invoices).set({ amount: String(n) }).where(eq(invoices.id, inv.id));
  else {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (job) await db.insert(invoices).values({ jobId, amount: String(n), currency: job.currency });
  }
  touch(jobId);
  return {};
}
