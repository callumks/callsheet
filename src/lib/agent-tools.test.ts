import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { invoices, jobs } from "@/db/schema";
import { resetDb } from "@/test/db";
import { runTool } from "./agent-tools";

const now = new Date("2027-05-10T12:00:00Z");

beforeEach(resetDb);

async function job(over: Partial<typeof jobs.$inferInsert>, inv?: Partial<typeof invoices.$inferInsert>) {
  const [j] = await db.insert(jobs).values({ status: "wrapped", currency: "GBP", timezone: "Europe/London", ...over }).returning();
  if (inv) await db.insert(invoices).values({ jobId: j.id, currency: "GBP", ...inv });
  return j;
}

describe("agent tools", () => {
  it("list_jobs returns overlapping jobs in order", async () => {
    await job({ client: "B", startDate: "2027-05-12", endDate: "2027-05-13", callTime: "07:00", status: "confirmed" });
    await job({ client: "A", startDate: "2027-05-11", endDate: "2027-05-11" });
    await job({ client: "C", startDate: "2027-06-01", endDate: "2027-06-01" });
    const r = await runTool("list_jobs", { from: "2027-05-11", to: "2027-05-12" }, { now });
    expect((r as { jobs: { name: string; call_time: string | null }[] }).jobs.map((j) => [j.name, j.call_time])).toEqual([["A", null], ["B", "07:00"]]);
  });

  it("earnings totals by currency with overdue split out", async () => {
    await job({ client: "A", startDate: "2027-04-01", endDate: "2027-04-02" }, { amount: "2000", status: "paid" });
    await job({ client: "B", startDate: "2027-04-10", endDate: "2027-04-10" }, { amount: "900", status: "invoiced", dueAt: new Date("2027-05-01") });
    await job({ client: "C", startDate: "2027-04-20", endDate: "2027-04-20", currency: "USD" }, { amount: "2500", currency: "USD", status: "to_invoice" });
    await job({ client: "D", startDate: "2027-04-21", endDate: "2027-04-21", status: "cancelled" }, { amount: "500", status: "to_invoice" });
    const r = await runTool("earnings", { from: "2027-04-01", to: "2027-04-30" }, { now });
    expect(r).toEqual({
      from: "2027-04-01",
      to: "2027-04-30",
      by_currency: {
        GBP: { total: 2900, paid: 2000, invoiced: 900, to_invoice: 0, overdue: 900, jobs: 2, days: 3 },
        USD: { total: 2500, paid: 0, invoiced: 0, to_invoice: 2500, overdue: 0, jobs: 1, days: 1 },
      },
    });
  });

  it("unpaid lists worked, unpaid jobs only", async () => {
    await job({ client: "Paid", startDate: "2027-04-01", endDate: "2027-04-01" }, { amount: "1", status: "paid" });
    await job({ client: "Owed", startDate: "2027-04-02", endDate: "2027-04-02" }, { amount: "1", status: "invoiced" });
    await job({ client: "Future", startDate: "2027-06-02", endDate: "2027-06-02", status: "confirmed" }, { amount: "1", status: "to_invoice" });
    const r = (await runTool("unpaid", {}, { now })) as { unpaid: { name: string }[] };
    expect(r.unpaid.map((u) => u.name)).toEqual(["Owed"]);
  });

  it("draft_invoice_chase writes an overdue chase without sending", async () => {
    const j = await job(
      { client: "Studio Halden", booker: "Jo Halvorsen", startDate: "2027-04-01", endDate: "2027-04-01" },
      { amount: "950", status: "invoiced", dueAt: new Date("2027-05-01T12:00:00Z") },
    );
    const r = (await runTool("draft_invoice_chase", { job_id: j.id }, { now })) as { draft: { subject: string; body: string }; note: string };
    expect(r.draft.subject).toBe("Invoice: Studio Halden on Thu 1 Apr");
    expect(r.draft.body).toContain("Hi Jo,");
    expect(r.draft.body).toContain("(£950). It was due on Sat 1 May, 9 days ago.");
    expect(r.note).toMatch(/Nothing was sent/);
  });

  it("rejects bad arguments", async () => {
    await expect(runTool("list_jobs", { from: "May" }, { now })).rejects.toThrow();
  });
});
