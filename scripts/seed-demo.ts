// Fills the database with fake jobs for screenshots and local development.
// Usage: pnpm seed:demo [--reset]   (--reset wipes every table first)

import "./env";

import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { emails, invoices, jobs, travel, type NewJob } from "../src/db/schema";
import { eachDay } from "../src/lib/format";
import { syncReminders } from "../src/lib/reminders";

const today = new Date();
const day = (offset: number) => new Date(today.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
const at = (offset: number, hhmm = "12:00") => new Date(`${day(offset)}T${hhmm}:00Z`);

type Seed = Omit<NewJob, "status"> & {
  status: NonNullable<NewJob["status"]>;
  invoice?: "to_invoice" | "invoiced" | "paid" | "overdue";
  travel?: { kind: "flight" | "hotel" | "car"; from?: string; to?: string; depart: Date; reference: string }[];
};

const seeds: Seed[] = [
  // Upcoming
  { client: "Northbound", agency: "North Agency", booker: "Jo Halvorsen", jobType: "e-commerce", status: "confirmed", startDate: day(2), endDate: day(2), callTime: "07:00", wrapTime: "18:00", location: "Studio Halden, Hackney Wick", timezone: "Europe/London", dayRate: "1200", currency: "GBP", usage: "12 months web + social, UK" },
  { client: "Meridian Eyewear", agency: "North Agency", booker: "Jo Halvorsen", jobType: "campaign", status: "confirmed", startDate: day(5), endDate: day(6), callTime: "08:30", wrapTime: "19:00", location: "Pier 59, New York", timezone: "America/New_York", dayRate: "2500", currency: "USD", usage: "Global, 2 years, all media. Usage fee $4,000 on top.",
    travel: [{ kind: "flight", from: "LHR", to: "JFK", depart: at(4, "11:20"), reference: "QX7P2L" }, { kind: "hotel", to: "The Ludlow, 180 Ludlow St", depart: at(4, "20:00"), reference: "HB-48812" }] },
  { client: "Halden & Co", agency: "Select Talent", booker: "Priya Nair", jobType: "lookbook", status: "option_1", startDate: day(8), endDate: day(8), callTime: "09:00", location: "Big Sky Studios", timezone: "Europe/London", dayRate: "900", currency: "GBP" },
  { client: "Orbit Running", agency: "Select Talent", booker: "Priya Nair", jobType: "campaign", status: "option_2", startDate: day(11), endDate: day(12), location: "TBC, Lisbon", timezone: "Europe/Lisbon", dayRate: "1500", currency: "EUR", needsReview: true, reviewReason: "call_time missing; location uncertain" },
  { client: "Fable Knitwear", agency: "North Agency", booker: "Tom Reilly", jobType: "e-commerce", status: "confirmed", startDate: day(16), endDate: day(16), callTime: "10:00", wrapTime: "16:00", location: "Loft 4, Peckham", timezone: "Europe/London", dayRate: "800", currency: "GBP" },
  { client: "Studio Vale", agency: "Select Talent", booker: "Priya Nair", jobType: "fitting", status: "confirmed", startDate: day(24), endDate: day(24), callTime: "14:00", location: "Vale HQ, Soho", timezone: "Europe/London", dayRate: "250", currency: "GBP" },
  // Past
  { client: "Northbound", agency: "North Agency", booker: "Jo Halvorsen", jobType: "e-commerce", status: "wrapped", startDate: day(-6), endDate: day(-6), callTime: "07:30", location: "Studio Halden", timezone: "Europe/London", dayRate: "1200", currency: "GBP", invoice: "to_invoice" },
  { client: "Cove Swim", agency: "Select Talent", booker: "Priya Nair", jobType: "campaign", status: "wrapped", startDate: day(-19), endDate: day(-18), callTime: "06:00", location: "Camber Sands", timezone: "Europe/London", dayRate: "1800", currency: "GBP", invoice: "invoiced" },
  { client: "Atlas Denim", agency: "North Agency", booker: "Tom Reilly", jobType: "lookbook", status: "wrapped", startDate: day(-41), endDate: day(-41), callTime: "09:00", location: "Studio 2, Shoreditch", timezone: "Europe/London", dayRate: "950", currency: "GBP", invoice: "overdue" },
  { client: "Meridian Eyewear", agency: "North Agency", booker: "Jo Halvorsen", jobType: "e-commerce", status: "wrapped", startDate: day(-55), endDate: day(-55), callTime: "08:00", location: "Pier 59, New York", timezone: "America/New_York", dayRate: "2200", currency: "USD", invoice: "paid" },
  { client: "Halden & Co", agency: "Select Talent", booker: "Priya Nair", jobType: "campaign", status: "wrapped", startDate: day(-70), endDate: day(-68), callTime: "08:00", location: "Big Sky Studios", timezone: "Europe/London", dayRate: "1400", currency: "GBP", invoice: "paid" },
  { client: "Fable Knitwear", agency: "North Agency", booker: "Tom Reilly", jobType: "e-commerce", status: "wrapped", startDate: day(-96), endDate: day(-96), callTime: "10:00", location: "Loft 4, Peckham", timezone: "Europe/London", dayRate: "800", currency: "GBP", invoice: "paid" },
  { client: "Orbit Running", agency: "Select Talent", booker: "Priya Nair", jobType: "campaign", status: "wrapped", startDate: day(-120), endDate: day(-119), callTime: "07:00", location: "Lisbon", timezone: "Europe/Lisbon", dayRate: "1500", currency: "GBP", invoice: "paid" },
  { client: "Cove Swim", agency: "Select Talent", booker: "Priya Nair", jobType: "e-commerce", status: "wrapped", startDate: day(-150), endDate: day(-150), callTime: "09:00", location: "Studio Halden", timezone: "Europe/London", dayRate: "1000", currency: "GBP", invoice: "paid" },
  { client: "Atlas Denim", agency: "North Agency", booker: "Tom Reilly", jobType: "campaign", status: "cancelled", startDate: day(-30), endDate: day(-30), callTime: "09:00", location: "Studio 2", timezone: "Europe/London", dayRate: "950", currency: "GBP", invoice: "invoiced" }, // kill fee
];

async function main() {
  if (process.argv.includes("--reset")) {
    await db.execute(sql`TRUNCATE reminders, invoices, travel, jobs, emails RESTART IDENTITY CASCADE`);
  }
  let n = 0;
  for (const s of seeds) {
    const { invoice, travel: trips, ...jobFields } = s;
    const [email] = await db
      .insert(emails)
      .values({
        gmailId: `demo-${n++}`,
        threadId: `demo-thread-${n}`,
        from: `${s.booker} <${s.booker!.split(" ")[0].toLowerCase()}@${s.agency!.toLowerCase().replace(/[^a-z]/g, "")}.example>`,
        subject: `${s.status === "confirmed" ? "CONFIRMED" : s.status.startsWith("option") ? "Option" : "Booking"}: ${s.client} ${s.startDate}`,
        receivedAt: at(-3),
        classifiedAs: "new_booking",
        processedAt: at(-3),
      })
      .returning();
    const [job] = await db.insert(jobs).values({ ...jobFields, sourceEmailId: email.id, threadId: email.threadId }).returning();

    const days = eachDay(job.startDate!, job.endDate).length;
    const amount = String(Number(job.dayRate) * days);
    if (invoice || job.status === "confirmed") {
      const status = invoice === "overdue" ? "invoiced" : (invoice ?? "to_invoice");
      const end = new Date(`${job.endDate}T12:00:00Z`);
      await db.insert(invoices).values({
        jobId: job.id,
        amount: job.status === "cancelled" ? String(Number(amount) / 2) : amount,
        currency: job.currency,
        status,
        sentAt: status === "to_invoice" ? null : new Date(end.getTime() + 2 * 86_400_000),
        dueAt: status === "to_invoice" ? null : new Date(end.getTime() + (invoice === "overdue" ? 12 : 32) * 86_400_000),
        paidAt: status === "paid" ? new Date(end.getTime() + 25 * 86_400_000) : null,
      });
    }
    for (const t of trips ?? []) {
      await db.insert(travel).values({ jobId: job.id, kind: t.kind, from: t.from, to: t.to, departAt: t.depart, reference: t.reference, threadId: email.threadId, sourceEmailId: email.id });
    }
    await syncReminders(db, job, { invoiced: !!invoice && invoice !== "to_invoice" });
  }
  console.log(`seeded ${seeds.length} jobs`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
