import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { emails, googleAccounts, jobs } from "@/db/schema";
import type { Extraction } from "./extract";
import type { MessageBody, MessageMeta } from "./gmail";
import { runSync } from "./pipeline";
import { resetDb } from "@/test/db";

const NOW = new Date("2027-03-01T10:00:00Z");

const inbox: Record<string, MessageBody> = {
  m1: {
    gmailId: "m1",
    threadId: "t1",
    from: "Jo <jo@northagency.example>",
    subject: "CONFIRMED: Northbound 15 Mar",
    receivedAt: NOW,
    snippet: "",
    text: "Confirmed. Call 07:00 at Studio Halden. £1200/day.",
  },
  m2: {
    gmailId: "m2",
    threadId: "t2",
    from: "deals@shop.example",
    subject: "Your order has shipped",
    receivedAt: NOW,
    snippet: "",
    text: "thanks for shopping",
  },
  m3: {
    gmailId: "m3",
    threadId: "t3",
    from: "friend@gmail.com",
    subject: "Booking a table?",
    receivedAt: NOW,
    snippet: "",
    text: "dinner friday?",
  },
  m4: {
    gmailId: "m4",
    threadId: "t4",
    from: "x@northagency.example",
    subject: "boom",
    receivedAt: NOW,
    snippet: "",
    text: "explode",
  },
};

const extraction: Extraction = {
  job: {
    client: "Northbound",
    agency: "North Agency",
    booker: "Jo",
    job_type: null,
    status: "confirmed",
    start_date: "2027-03-15",
    end_date: "2027-03-15",
    call_time: "07:00",
    wrap_time: null,
    location: "Studio Halden",
    timezone: "Europe/London",
    day_rate: 1200,
    currency: "GBP",
    usage: null,
    notes: null,
  },
  travel: [],
  payment: null,
  changes: [],
  confidence: 0.9,
  uncertain_fields: [],
};

const bodiesRead: string[] = [];

const fakes = {
  db,
  now: () => NOW,
  accessToken: async () => "tok",
  listNewMessageIds: async () => ({ ids: Object.keys(inbox), historyId: "h-200" }),
  getMessageMeta: async (_t: string, id: string): Promise<MessageMeta> => {
    const { text: _text, ...meta } = inbox[id];
    return meta;
  },
  getMessageBody: async (_t: string, id: string) => {
    bodiesRead.push(id);
    return inbox[id];
  },
  classify: async (e: MessageBody) => {
    if (e.gmailId === "m4") throw new Error("model exploded");
    return e.gmailId === "m1"
      ? { label: "new_booking" as const, confidence: 0.95, reason: "" }
      : { label: "irrelevant" as const, confidence: 0.9, reason: "" };
  },
  extract: async () => extraction,
};

beforeEach(async () => {
  await resetDb();
  bodiesRead.length = 0;
  process.env.AGENCY_DOMAINS = "northagency.example";
  await db.insert(googleAccounts).values({ email: "me@example.com", refreshTokenEnc: "x", lastHistoryId: "h-100" });
});

describe("runSync", () => {
  it("runs the five steps and never reads filtered bodies", async () => {
    const s = await runSync(fakes);
    expect(s).toMatchObject({ fetched: 4, skipped: 0, filteredOut: 1, irrelevant: 1, applied: 1, historyId: "h-200" });
    expect(s.errors).toEqual([{ gmailId: "m4", error: "model exploded" }]);
    expect(bodiesRead.sort()).toEqual(["m1", "m3", "m4"]); // m2 stopped at the headers

    const all = await db.select().from(emails).orderBy(emails.gmailId);
    expect(all.map((e) => [e.gmailId, e.classifiedAs, !!e.processedAt, e.error])).toEqual([
      ["m1", "new_booking", true, null],
      ["m2", null, true, null],
      ["m3", "irrelevant", true, null],
      ["m4", null, false, "model exploded"],
    ]);
    expect(await db.select().from(jobs)).toHaveLength(1);

    const [acct] = await db.select().from(googleAccounts);
    expect(acct.lastHistoryId).toBe("h-200");
    expect(acct.lastSyncedAt?.toISOString()).toBe(NOW.toISOString());
  });

  it("is idempotent across runs", async () => {
    await runSync(fakes);
    const s = await runSync(fakes);
    expect(s.skipped).toBe(4);
    expect(s.applied).toBe(0);
    expect(await db.select().from(jobs)).toHaveLength(1);
  });

  it("does nothing without a connected account", async () => {
    await db.delete(googleAccounts).where(eq(googleAccounts.email, "me@example.com"));
    const s = await runSync(fakes);
    expect(s.account).toBeNull();
    expect(s.fetched).toBe(0);
  });
});
