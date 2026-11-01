import { sql } from "drizzle-orm";
import { db } from "@/db";

/** Every DB-backed test runs as this user unless it makes another. */
export const TEST_USER = "00000000-0000-4000-8000-0000000000aa";

/** Wipe every table between DB-backed tests, leaving just the test user. */
export async function resetDb() {
  if (!/test/.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("Refusing to truncate: DATABASE_URL does not look like a test database. Create .env.test.");
  }
  await db.execute(
    sql`TRUNCATE reminders, invoices, expenses, travel, jobs, emails, push_subscriptions, google_accounts, users RESTART IDENTITY CASCADE`,
  );
  const { users } = await import("@/db/schema");
  await db.insert(users).values({ id: TEST_USER, email: "me@example.com" });
}

export async function insertUser(email: string) {
  const { users } = await import("@/db/schema");
  const [row] = await db.insert(users).values({ email }).returning();
  return row;
}

export async function insertEmail(over: Partial<typeof import("@/db/schema").emails.$inferInsert> = {}) {
  const { emails } = await import("@/db/schema");
  const [row] = await db
    .insert(emails)
    .values({
      userId: TEST_USER,
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
