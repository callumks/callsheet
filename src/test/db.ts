import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Wipe every table between DB-backed tests. */
export async function resetDb() {
  await db.execute(
    sql`TRUNCATE reminders, invoices, travel, jobs, emails, push_subscriptions, google_accounts RESTART IDENTITY CASCADE`,
  );
}

export async function insertEmail(over: Partial<typeof import("@/db/schema").emails.$inferInsert> = {}) {
  const { emails } = await import("@/db/schema");
  const [row] = await db
    .insert(emails)
    .values({
      gmailId: `g-${Math.random().toString(36).slice(2)}`,
      threadId: "t-1",
      from: "Jo <jo@northagency.example>",
      subject: "Confirmed",
      receivedAt: new Date("2027-03-01T09:00:00Z"),
      ...over,
    })
    .returning();
  return row;
}
