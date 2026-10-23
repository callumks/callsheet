import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { invoices, jobs, reminders } from "@/db/schema";
import { resetDb } from "@/test/db";
import { nextOverdueAt, scheduleOverdue } from "./overdue";

beforeEach(resetDb);

describe("nextOverdueAt", () => {
  const inv = { dueAt: new Date("2027-04-01T12:00:00Z") };
  it("is due + 1 day at 10:00 local", () => {
    expect(nextOverdueAt(inv, "Europe/London", null)?.toISOString()).toBe("2027-04-02T09:00:00.000Z");
  });
  it("then weekly after the last one sent", () => {
    expect(nextOverdueAt(inv, "Europe/London", new Date("2027-04-02T09:00:00Z"))?.toISOString()).toBe("2027-04-09T09:00:00.000Z");
    expect(nextOverdueAt(inv, "Europe/London", new Date("2027-04-09T09:00:00Z"))?.toISOString()).toBe("2027-04-16T09:00:00.000Z");
  });
  it("needs a due date", () => {
    expect(nextOverdueAt({ dueAt: null }, "Europe/London", null)).toBeNull();
  });
});

async function setup(status: "invoiced" | "paid" | "to_invoice", dueAt: Date | null) {
  const [job] = await db
    .insert(jobs)
    .values({ client: "Atlas Denim", status: "wrapped", startDate: "2027-03-01", endDate: "2027-03-01", timezone: "Europe/London", currency: "GBP" })
    .returning();
  const [inv] = await db.insert(invoices).values({ jobId: job.id, amount: "950", currency: "GBP", status, dueAt }).returning();
  return { job, inv };
}

describe("scheduleOverdue", () => {
  it("queues one nudge, then the next only after it is sent", async () => {
    const { job } = await setup("invoiced", new Date("2027-04-01T12:00:00Z"));
    const now = new Date("2027-04-01T13:00:00Z");
    expect(await scheduleOverdue(db, now)).toEqual({ scheduled: 1, cleared: 0 });
    expect(await scheduleOverdue(db, now)).toEqual({ scheduled: 0, cleared: 0 });

    const [r] = await db.select().from(reminders).where(eq(reminders.jobId, job.id));
    expect(r.sendAt.toISOString()).toBe("2027-04-02T09:00:00.000Z");
    expect(r.title).toBe("Atlas Denim is 1 day overdue");
    expect(r.body).toBe("£950 · due 2027-04-01");

    await db.update(reminders).set({ sentAt: r.sendAt }).where(eq(reminders.id, r.id));
    await scheduleOverdue(db, new Date("2027-04-03T00:00:00Z"));
    const all = await db.select().from(reminders).orderBy(reminders.sendAt);
    expect(all.map((x) => x.sendAt.toISOString())).toEqual(["2027-04-02T09:00:00.000Z", "2027-04-09T09:00:00.000Z"]);
    expect(all[1].title).toBe("Atlas Denim is 8 days overdue");
  });

  it("ignores invoices not yet near due, and to_invoice", async () => {
    await setup("invoiced", new Date("2027-05-01T12:00:00Z"));
    await setup("to_invoice", null);
    expect(await scheduleOverdue(db, new Date("2027-04-01T00:00:00Z"))).toEqual({ scheduled: 0, cleared: 0 });
  });

  it("clears a pending nudge once paid", async () => {
    const { inv } = await setup("invoiced", new Date("2027-04-01T12:00:00Z"));
    await scheduleOverdue(db, new Date("2027-04-01T13:00:00Z"));
    await db.update(invoices).set({ status: "paid" }).where(eq(invoices.id, inv.id));
    expect(await scheduleOverdue(db, new Date("2027-04-01T14:00:00Z"))).toEqual({ scheduled: 0, cleared: 1 });
    expect(await db.select().from(reminders)).toHaveLength(0);
  });

  it("catches up after downtime without a backlog", async () => {
    await setup("invoiced", new Date("2027-04-01T12:00:00Z"));
    await scheduleOverdue(db, new Date("2027-05-01T00:00:00Z"));
    const [r] = await db.select().from(reminders);
    expect(r.sendAt.toISOString()).toBe("2027-04-30T09:00:00.000Z");
  });
});
