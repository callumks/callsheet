import {
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Enums ---------------------------------------------------------------------

export const emailClass = pgEnum("email_class", [
  "new_booking",
  "update",
  "travel",
  "payment",
  "irrelevant",
]);

export const jobStatus = pgEnum("job_status", [
  "option_1",
  "option_2",
  "confirmed",
  "cancelled",
  "wrapped",
]);

export const travelKind = pgEnum("travel_kind", ["flight", "hotel", "car"]);

// `overdue` is derived from due_at at read time, never written.
export const invoiceStatus = pgEnum("invoice_status", [
  "to_invoice",
  "invoiced",
  "paid",
]);

export const reminderKind = pgEnum("reminder_kind", [
  "new_booking",
  "job_changed",
  "night_before",
  "call_time",
  "invoice_due",
  "overdue",
]);

// Tables --------------------------------------------------------------------

// Raw metadata only. The body is fetched on demand and never stored.
export const emails = pgTable("emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  gmailId: text("gmail_id").notNull().unique(),
  threadId: text("thread_id").notNull(),
  from: text("from").notNull(),
  subject: text("subject").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  classifiedAs: emailClass("classified_as"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

// A multi-day job is one row with a date range.
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  client: text("client"),
  agency: text("agency"),
  booker: text("booker"),
  jobType: text("job_type"),
  status: jobStatus("status").notNull().default("option_1"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  callTime: time("call_time"),
  wrapTime: time("wrap_time"),
  location: text("location"),
  timezone: text("timezone"),
  dayRate: numeric("day_rate", { precision: 12, scale: 2 }),
  currency: text("currency"),
  usage: text("usage"),
  needsReview: integer("needs_review").notNull().default(0),
  sourceEmailId: uuid("source_email_id").references(() => emails.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// job_id is optional; a trip can stand alone.
export const travel = pgTable("travel", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  kind: travelKind("kind").notNull(),
  from: text("from"),
  to: text("to"),
  departAt: timestamp("depart_at", { withTimezone: true }),
  arriveAt: timestamp("arrive_at", { withTimezone: true }),
  reference: text("reference"),
  sourceEmailId: uuid("source_email_id").references(() => emails.id),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  currency: text("currency"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  status: invoiceStatus("status").notNull().default("to_invoice"),
});

// Scheduled pushes, in the job's local time zone.
export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
  kind: reminderKind("kind").notNull(),
  sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  payload: text("payload").notNull(),
});

export type Email = typeof emails.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Travel = typeof travel.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
