import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { invoices, jobs, reminders, travel } from "@/db/schema";
import type { Extraction } from "./extract";
import { insertEmail, resetDb } from "@/test/db";
import { applyExtraction, findMatchingJob, wrapFinishedJobs } from "./upsert";

const NOW = new Date("2027-03-01T10:00:00Z");

const booking: Extraction = {
  job: {
    client: "Northbound",
    agency: "North Agency",
    booker: "Jo",
    job_type: "e-commerce",
    status: "confirmed",
    start_date: "2027-03-15",
    end_date: "2027-03-16",
    call_time: "07:00",
    wrap_time: "18:00",
    location: "Studio Halden, London",
    timezone: "Europe/London",
    day_rate: 1200,
    currency: "GBP",
    usage: null,
    notes: null,
  },
  travel: [],
  payment: null,
  changes: [],
  confidence: 0.95,
  uncertain_fields: [],
};

beforeEach(resetDb);

describe("applyExtraction", () => {
  it("creates a job, a to_invoice invoice, and reminders", async () => {
    const email = await insertEmail({ threadId: "t-1" });
    const r = await applyExtraction({ email, label: "new_booking", extraction: booking, now: NOW });
    expect(r.created).toBe(true);
    expect(r.job?.client).toBe("Northbound");
    expect(r.job?.needsReview).toBe(false);
    expect(r.invoice?.status).toBe("to_invoice");
    expect(r.invoice?.amount).toBe("2400.00");

    const rs = await db.select().from(reminders).where(eq(reminders.jobId, r.job!.id));
    const kinds = rs.map((x) => x.kind).sort();
    // immediate new_booking + 2 nights before + 2 call-time + invoice_due
    expect(kinds).toEqual(["call_time", "call_time", "invoice_due", "new_booking", "night_before", "night_before"]);
    const nb = rs.find((x) => x.kind === "new_booking")!;
    expect(nb.title).toBe("Booked: Northbound");
    expect(nb.body).toBe("Mon 15 Mar, call 07:00");
    const night = rs.filter((x) => x.kind === "night_before").sort((a, b) => +a.sendAt - +b.sendAt)[0];
    expect(night.sendAt.toISOString()).toBe("2027-03-14T20:00:00.000Z"); // GMT in March
    const call = rs.filter((x) => x.kind === "call_time").sort((a, b) => +a.sendAt - +b.sendAt)[0];
    expect(call.sendAt.toISOString()).toBe("2027-03-15T05:00:00.000Z");
  });

  it("flags a job for review when required fields are missing", async () => {
    const email = await insertEmail();
    const r = await applyExtraction({
      email,
      label: "new_booking",
      extraction: { ...booking, job: { ...booking.job!, call_time: null, day_rate: null } },
      now: NOW,
    });
    expect(r.job?.needsReview).toBe(true);
    expect(r.job?.reviewReason).toBe("call_time missing; day_rate missing");
  });

  it("updates the same job on the same thread and records changes", async () => {
    const e1 = await insertEmail({ threadId: "t-9" });
    const first = await applyExtraction({
      email: e1,
      label: "new_booking",
      extraction: { ...booking, job: { ...booking.job!, status: "option_1" } },
      now: NOW,
    });
    const e2 = await insertEmail({ threadId: "t-9" });
    const second = await applyExtraction({
      email: e2,
      label: "update",
      extraction: {
        ...booking,
        job: { ...booking.job!, status: "confirmed", call_time: "08:30", agency: null, day_rate: null },
        changes: ["call time 07:00 → 08:30"],
      },
      now: new Date(NOW.getTime() + 60_000),
    });
    expect(second.created).toBe(false);
    expect(second.job?.id).toBe(first.job?.id);
    expect(second.job?.agency).toBe("North Agency"); // null never overwrites
    expect(second.job?.dayRate).toBe("1200.00");
    expect(second.changes).toEqual([
      { field: "status", from: "option_1", to: "confirmed" },
      { field: "callTime", from: "07:00", to: "08:30" },
    ]);
    const all = await db.select().from(jobs);
    expect(all).toHaveLength(1);
    const rs = await db.select().from(reminders).where(eq(reminders.kind, "job_changed"));
    expect(rs).toHaveLength(1);
    expect(rs[0].body).toBe("status option_1 → confirmed\ncall time 07:00 → 08:30");
    // Options got no scheduled reminders; confirmation created them.
    const sched = await db.select().from(reminders).where(eq(reminders.kind, "call_time"));
    expect(sched).toHaveLength(2);
    expect(sched[0].title).toBe("Northbound · call 08:30");
  });

  it("matches by agency + client + date overlap on a new thread", async () => {
    const e1 = await insertEmail({ threadId: "t-a" });
    const first = await applyExtraction({ email: e1, label: "new_booking", extraction: booking, now: NOW });
    const e2 = await insertEmail({ threadId: "t-b", from: "Sam <sam@northagency.example>" });
    const second = await applyExtraction({
      email: e2,
      label: "update",
      extraction: { ...booking, job: { ...booking.job!, client: "northbound", start_date: "2027-03-16", end_date: "2027-03-17", location: "Pier 9" } },
      now: NOW,
    });
    expect(second.job?.id).toBe(first.job?.id);
    expect(second.changes.map((c) => c.field).sort()).toEqual(["endDate", "location", "startDate"]);
  });

  it("starts a new job for a different client", async () => {
    const e1 = await insertEmail({ threadId: "t-a" });
    await applyExtraction({ email: e1, label: "new_booking", extraction: booking, now: NOW });
    const e2 = await insertEmail({ threadId: "t-b" });
    const r = await applyExtraction({
      email: e2,
      label: "new_booking",
      extraction: { ...booking, job: { ...booking.job!, client: "Halden Co" } },
      now: NOW,
    });
    expect(r.created).toBe(true);
    expect(await db.select().from(jobs)).toHaveLength(2);
  });

  it("links travel in the same thread to the job and feeds the night-before push", async () => {
    const e1 = await insertEmail({ threadId: "t-a" });
    const first = await applyExtraction({ email: e1, label: "new_booking", extraction: booking, now: NOW });
    const e2 = await insertEmail({ threadId: "t-a", subject: "Your flight" });
    const r = await applyExtraction({
      email: e2,
      label: "travel",
      extraction: {
        ...booking,
        job: null,
        travel: [{ kind: "flight", from: "LHR", to: "JFK", depart_at: "2027-03-14T07:15:00.000Z", arrive_at: null, reference: "PNR123" }],
      },
      now: NOW,
    });
    expect(r.job?.id).toBe(first.job?.id);
    expect(r.travel[0].jobId).toBe(first.job?.id);
    const night = (await db.select().from(reminders).where(eq(reminders.kind, "night_before")))[0];
    expect(night.body).toContain("flight · LHR → JFK · 07:15 · PNR123");
    // Re-applying the same PNR does not duplicate.
    await applyExtraction({ email: e2, label: "travel", extraction: { ...booking, job: null, travel: [{ kind: "flight", from: "LHR", to: "JFK", depart_at: null, arrive_at: null, reference: "PNR123" }] }, now: NOW });
    expect(await db.select().from(travel)).toHaveLength(1);
  });

  it("marks the invoice paid from a payment email and drops the invoice nudge", async () => {
    const e1 = await insertEmail({ threadId: "t-a" });
    const first = await applyExtraction({ email: e1, label: "new_booking", extraction: booking, now: NOW });
    const e2 = await insertEmail({ threadId: "t-pay", from: "accounts@northagency.example", subject: "Remittance" });
    const r = await applyExtraction({
      email: e2,
      label: "payment",
      extraction: {
        ...booking,
        job: { ...booking.job!, status: null, call_time: null, location: null, day_rate: null, timezone: null },
        payment: { amount: 2400, currency: "GBP", status: "paid", sent_at: null, due_at: null, paid_at: "2027-04-02" },
      },
      now: NOW,
    });
    expect(r.job?.id).toBe(first.job?.id);
    expect(r.invoice?.status).toBe("paid");
    expect(r.invoice?.paidAt?.toISOString().slice(0, 10)).toBe("2027-04-02");
    const due = await db.select().from(reminders).where(eq(reminders.kind, "invoice_due"));
    expect(due).toHaveLength(0);
    expect((await db.select().from(invoices))).toHaveLength(1);
  });
});

describe("findMatchingJob", () => {
  it("returns null without names or thread", async () => {
    expect(await findMatchingJob(db, { threadId: "none", agency: null, client: null, startDate: null, endDate: null })).toBeNull();
  });
});

describe("wrapFinishedJobs", () => {
  it("flips confirmed jobs whose end date has passed", async () => {
    const e = await insertEmail();
    await applyExtraction({ email: e, label: "new_booking", extraction: booking, now: NOW });
    expect(await wrapFinishedJobs(db, "2027-03-16")).toBe(1);
    expect(await wrapFinishedJobs(db, "2027-03-16")).toBe(0);
    expect((await db.select().from(jobs))[0].status).toBe("wrapped");
  });
});
