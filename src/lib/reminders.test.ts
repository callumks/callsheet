import { describe, expect, it } from "vitest";
import type { Job } from "@/db/schema";
import { addDays, localInstant, planReminders } from "./reminders";

const job: Job = {
  id: "00000000-0000-0000-0000-000000000001",
  client: "Northbound",
  agency: "North",
  booker: null,
  jobType: null,
  status: "confirmed",
  startDate: "2027-07-05",
  endDate: "2027-07-05",
  callTime: "07:00:00",
  wrapTime: null,
  location: "Pier 17, New York",
  timezone: "America/New_York",
  dayRate: "2500.00",
  currency: "USD",
  usage: null,
  notes: null,
  needsReview: false,
  reviewReason: null,
  threadId: "t",
  sourceEmailId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("localInstant", () => {
  it("respects DST in the job's zone", () => {
    expect(localInstant("2027-07-05", "07:00", "America/New_York").toISOString()).toBe("2027-07-05T11:00:00.000Z");
    expect(localInstant("2027-01-05", "07:00", "America/New_York").toISOString()).toBe("2027-01-05T12:00:00.000Z");
    expect(localInstant("2027-07-05", "20:00", "Europe/London").toISOString()).toBe("2027-07-05T19:00:00.000Z");
  });
  it("addDays crosses months", () => {
    expect(addDays("2027-03-01", -1)).toBe("2027-02-28");
  });
});

describe("planReminders", () => {
  const now = new Date("2027-06-01T00:00:00Z");
  it("plans night-before, call-time and invoice-due in local time", () => {
    const plan = planReminders(job, { now });
    expect(plan.map((p) => [p.kind, p.sendAt.toISOString()])).toEqual([
      ["night_before", "2027-07-05T00:00:00.000Z"], // 20:00 EDT on the 4th
      ["call_time", "2027-07-05T09:00:00.000Z"], // 05:00 EDT
      ["invoice_due", "2027-07-06T14:00:00.000Z"], // 10:00 EDT on the 6th
    ]);
    expect(plan[2].body).toBe("Wrapped Mon 5 Jul · US$2,500/day");
  });
  it("skips options, cancelled, and the past", () => {
    expect(planReminders({ ...job, status: "option_1" }, { now })).toEqual([]);
    expect(planReminders(job, { now: new Date("2027-07-05T10:00:00Z") }).map((p) => p.kind)).toEqual(["invoice_due"]);
  });
  it("drops the invoice nudge once invoiced", () => {
    expect(planReminders(job, { now, invoiced: true }).map((p) => p.kind)).toEqual(["night_before", "call_time"]);
  });
});
