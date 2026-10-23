import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { pushSubscriptions, reminders } from "@/db/schema";
import { resetDb } from "@/test/db";
import { sendDueReminders, type PushPayload, type Sender } from "./push";

const NOW = new Date("2027-03-14T20:01:00Z");

beforeEach(resetDb);

async function addReminder(sendAt: Date, title = "Tomorrow: Northbound") {
  const [r] = await db.insert(reminders).values({ kind: "night_before", sendAt, title, body: "Call 07:00", url: "/jobs/x" }).returning();
  return r;
}

async function addSub(endpoint: string) {
  await db.insert(pushSubscriptions).values({ endpoint, p256dh: "p", auth: "a" });
}

describe("sendDueReminders", () => {
  it("sends due reminders to every device and marks them sent", async () => {
    await addSub("https://push.example/a");
    await addSub("https://push.example/b");
    const due = await addReminder(new Date("2027-03-14T20:00:00Z"));
    await addReminder(new Date("2027-03-15T05:00:00Z"), "later");
    const calls: [string, PushPayload][] = [];
    const send: Sender = async (s, p) => {
      calls.push([s.endpoint, p]);
      return { gone: false };
    };
    const r = await sendDueReminders({ now: NOW, send });
    expect(r).toMatchObject({ sent: 1, devices: 2, removed: 0 });
    expect(calls.map((c) => c[0]).sort()).toEqual(["https://push.example/a", "https://push.example/b"]);
    expect(calls[0][1]).toEqual({ title: "Tomorrow: Northbound", body: "Call 07:00", url: "/jobs/x", tag: "night_before" });
    const [row] = await db.select().from(reminders).where(eq(reminders.id, due.id));
    expect(row.sentAt?.toISOString()).toBe(NOW.toISOString());
    // Second run sends nothing new.
    expect((await sendDueReminders({ now: NOW, send })).sent).toBe(0);
  });

  it("drops expired subscriptions", async () => {
    await addSub("https://push.example/gone");
    await addSub("https://push.example/ok");
    await addReminder(new Date("2027-03-14T20:00:00Z"));
    const r = await sendDueReminders({ now: NOW, send: async (s) => ({ gone: s.endpoint.endsWith("gone") }) });
    expect(r).toMatchObject({ sent: 1, removed: 1 });
    expect(await db.select().from(pushSubscriptions)).toHaveLength(1);
  });

  it("keeps reminders queued when no device is subscribed", async () => {
    await addReminder(new Date("2027-03-14T20:00:00Z"));
    const r = await sendDueReminders({ now: NOW, send: async () => ({ gone: false }) });
    expect(r.sent).toBe(0);
    expect((await db.select().from(reminders))[0].sentAt).toBeNull();
  });

  it("skips reminders that are hours stale", async () => {
    await addSub("https://push.example/a");
    await addReminder(new Date("2027-03-14T08:00:00Z"));
    let called = false;
    const r = await sendDueReminders({ now: NOW, send: async () => ((called = true), { gone: false }) });
    expect(r.skippedStale).toBe(1);
    expect(called).toBe(false);
  });
});
