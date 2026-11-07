// Read side for the three screens. Plain Drizzle, no caching: small tables,
// and the data must be live after a sync. Every read is scoped to one user.

import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { emails, expenses, googleAccounts, invoices, jobs, reminders, travel, type Expense, type Invoice, type Job } from "@/db/schema";
import { addDays } from "./reminders";

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export type InvoiceStatusView = "to_invoice" | "invoiced" | "paid" | "overdue";

/** `overdue` is derived: invoiced, unpaid, and past due_at. */
export function invoiceView(inv: Invoice | null | undefined, now = new Date()): InvoiceStatusView | null {
  if (!inv) return null;
  if (inv.status === "invoiced" && inv.dueAt && inv.dueAt < now) return "overdue";
  return inv.status;
}

export async function upcoming(userId: string, day = today()) {
  const horizon = addDays(day, 14);
  const rows = await db
    .select({ job: jobs, invoice: invoices })
    .from(jobs)
    .leftJoin(invoices, eq(invoices.jobId, jobs.id))
    .where(
      and(
        eq(jobs.userId, userId),
        ne(jobs.status, "cancelled"),
        or(gte(jobs.endDate, day), and(isNotNull(jobs.startDate), gte(jobs.startDate, day))),
      ),
    )
    .orderBy(asc(jobs.startDate), asc(jobs.callTime));

  const next = rows.find((r) => r.job.status === "confirmed") ?? rows[0] ?? null;
  const list = rows.filter((r) => r.job.id !== next?.job.id && (r.job.startDate ?? "") <= horizon);
  const later = rows.filter((r) => r.job.id !== next?.job.id && (r.job.startDate ?? "") > horizon);
  const undated = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.userId, userId), ne(jobs.status, "cancelled"), sql`${jobs.startDate} is null`))
    .orderBy(desc(jobs.updatedAt));
  return { next, list, later, undated };
}

export async function jobDetail(userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [job] = await db.select().from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.id, id))).limit(1);
  if (!job) return null;
  const [trips, [invoice], rems, source, spent] = await Promise.all([
    db.select().from(travel).where(eq(travel.jobId, id)).orderBy(asc(travel.departAt)),
    db.select().from(invoices).where(eq(invoices.jobId, id)).limit(1),
    db.select().from(reminders).where(eq(reminders.jobId, id)).orderBy(asc(reminders.sendAt)),
    job.sourceEmailId
      ? db.select().from(emails).where(eq(emails.id, job.sourceEmailId)).limit(1).then((r) => r[0] ?? null)
      : Promise.resolve(null),
    db.select().from(expenses).where(eq(expenses.jobId, id)).orderBy(asc(expenses.incurredOn)),
  ]);
  return { job, travel: trips, invoice: invoice ?? null, reminders: rems, source, expenses: spent };
}

export async function needsReviewCount(userId: string) {
  const [[{ n }], [{ e }]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.needsReview, true))),
    db
      .select({ e: sql<number>`count(*)::int` })
      .from(expenses)
      .where(and(eq(expenses.userId, userId), eq(expenses.needsReview, true))),
  ]);
  return n + e;
}

export async function expensesForReview(userId: string) {
  return db
    .select()
    .from(expenses)
    .where(and(eq(expenses.userId, userId), eq(expenses.needsReview, true)))
    .orderBy(desc(expenses.incurredOn));
}

export async function jobsForReview(userId: string) {
  return db
    .select()
    .from(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.needsReview, true)))
    // Newest work first, and a stable order: sorting by updated_at reshuffled the list after every sync.
    .orderBy(desc(jobs.startDate), desc(jobs.createdAt));
}

/** The user's connected inbox, or null when Gmail isn't connected. */
export async function syncState(userId: string) {
  const [acct] = await db
    .select({ email: googleAccounts.email, lastSyncedAt: googleAccounts.lastSyncedAt, needsReconnect: googleAccounts.needsReconnect })
    .from(googleAccounts)
    .where(eq(googleAccounts.userId, userId))
    .limit(1);
  return acct ?? null;
}

// --- Earnings --------------------------------------------------------------

export type MonthBar = { month: string; label: string; paid: number; invoiced: number; toInvoice: number; total: number };

export type EarningsView = {
  currency: string;
  otherCurrencies: string[];
  month: {
    label: string;
    total: number;
    paid: number;
    invoiced: number;
    toInvoice: number;
    overdue: number;
    /** Spend the talent keeps: not reimbursable. */
    expenses: number;
    net: number;
  };
  bars: MonthBar[];
  unpaid: { job: Job; invoice: Invoice; view: InvoiceStatusView; daysOverdue: number }[];
  /** This month's spend, newest first. */
  spent: { expense: Expense; job: Job | null }[];
  /** Reimbursable spend not yet paid back, any month. */
  owedBack: number;
};

function monthKey(d: string) {
  return d.slice(0, 7);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(key: string) {
  return MONTHS[Number(key.slice(5, 7)) - 1];
}

export async function earnings(userId: string, day = today(), now = new Date()): Promise<EarningsView> {
  // Six months back, inclusive of this one.
  const [y, m] = day.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 6, 1)).toISOString().slice(0, 10);
  const thisMonth = monthKey(day);

  const rows = await db
    .select({ job: jobs, invoice: invoices })
    .from(invoices)
    .innerJoin(jobs, eq(jobs.id, invoices.jobId))
    .where(
      and(
        eq(jobs.userId, userId),
        inArray(jobs.status, ["confirmed", "wrapped", "cancelled"]),
        isNotNull(jobs.startDate),
        gte(jobs.startDate, start),
      ),
    )
    .orderBy(asc(jobs.startDate));

  // Pick the currency with the most money in it; others are listed, not
  // converted. An invoice whose email never named a currency is in that
  // headline currency: the booker writes "5000", not "5000 USD", at home.
  const byCurrency = new Map<string, number>();
  for (const r of rows) {
    const c = r.invoice.currency ?? r.job.currency;
    if (c) byCurrency.set(c, (byCurrency.get(c) ?? 0) + Number(r.invoice.amount ?? 0));
  }
  const currency = [...byCurrency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "GBP";
  const otherCurrencies = [...byCurrency.keys()].filter((c) => c !== currency);

  const keys: string[] = [];
  for (let i = 5; i >= 0; i--) keys.push(new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
  const bars = new Map<string, MonthBar>(keys.map((k) => [k, { month: k, label: monthLabel(k), paid: 0, invoiced: 0, toInvoice: 0, total: 0 }]));

  const month = { label: monthLabel(thisMonth), total: 0, paid: 0, invoiced: 0, toInvoice: 0, overdue: 0, expenses: 0, net: 0 };
  const unpaid: EarningsView["unpaid"] = [];

  for (const r of rows) {
    const c = r.invoice.currency ?? r.job.currency ?? currency;
    if (c !== currency) continue;
    // Cancelled jobs count only if an invoice amount was set by hand (a kill fee).
    if (r.job.status === "cancelled" && r.invoice.status === "to_invoice") continue;
    const amt = Number(r.invoice.amount ?? 0);
    const view = invoiceView(r.invoice, now)!;
    const bucket = view === "paid" ? "paid" : view === "to_invoice" ? "toInvoice" : "invoiced";
    const k = monthKey(r.job.startDate!);
    const bar = bars.get(k);
    if (bar) {
      bar[bucket] += amt;
      bar.total += amt;
    }
    if (k === thisMonth) {
      month[bucket] += amt;
      month.total += amt;
      if (view === "overdue") month.overdue += amt;
    }
    if (view !== "paid" && r.job.status !== "cancelled" && (r.job.endDate ?? r.job.startDate!) <= day) {
      const daysOverdue =
        view === "overdue" && r.invoice.dueAt ? Math.floor((now.getTime() - r.invoice.dueAt.getTime()) / 86_400_000) : 0;
      unpaid.push({ job: r.job, invoice: r.invoice, view, daysOverdue });
    }
  }
  unpaid.sort((a, b) => (a.job.startDate ?? "").localeCompare(b.job.startDate ?? ""));

  // Expenses in the headline currency; an expense with no currency takes it.
  const spendRows = await db
    .select({ expense: expenses, job: jobs })
    .from(expenses)
    .leftJoin(jobs, eq(jobs.id, expenses.jobId))
    .where(and(eq(expenses.userId, userId), or(isNull(expenses.currency), eq(expenses.currency, currency))))
    .orderBy(desc(expenses.incurredOn));
  let owedBack = 0;
  const spent: EarningsView["spent"] = [];
  for (const r of spendRows) {
    const amt = Number(r.expense.amount);
    // Held for review: listed, but not counted until it is kept.
    const counts = !r.expense.needsReview;
    if (counts && r.expense.reimbursable && !r.expense.reimbursedAt) owedBack += amt;
    if (monthKey(r.expense.incurredOn) !== thisMonth) continue;
    spent.push(r);
    if (counts && !r.expense.reimbursable) month.expenses += amt;
  }
  month.net = month.total - month.expenses;

  return { currency, otherCurrencies, month, bars: [...bars.values()], unpaid, spent, owedBack };
}

export { lte };
