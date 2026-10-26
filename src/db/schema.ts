import {
  boolean,
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
  "expense",
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

export const expenseKind = pgEnum("expense_kind", ["flight", "hotel", "transport", "food", "kit", "other"]);

export const reminderKind = pgEnum("reminder_kind", [
  "new_booking",
  "job_changed",
  "night_before",
  "call_time",
  "invoice_due",
  "overdue",
]);

// Tables --------------------------------------------------------------------

// The one Google account the app reads. Refresh token is AES-256-GCM
// encrypted with TOKEN_ENCRYPTION_KEY; the plaintext never touches the DB.
export const googleAccounts = pgTable("google_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  refreshTokenEnc: text("refresh_token_enc").notNull(),
  lastHistoryId: text("last_history_id"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  error: text("error"),
  // Failed runs so far. Unprocessed emails are retried until this hits the cap.
  failures: integer("failures").notNull().default(0),
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
  notes: text("notes"),
  needsReview: boolean("needs_review").notNull().default(false),
  reviewReason: text("review_reason"),
  threadId: text("thread_id"),
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
  threadId: text("thread_id"),
  sourceEmailId: uuid("source_email_id").references(() => emails.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
  sourceEmailId: uuid("source_email_id").references(() => emails.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Money the talent paid out. Only their own spend is stored: travel the
// agency or client paid for lives in `travel` alone. job_id is optional;
// an expense with no job waits in review until it is linked or dismissed.
export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  kind: expenseKind("kind").notNull(),
  description: text("description"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency"),
  incurredOn: date("incurred_on").notNull(),
  reimbursable: boolean("reimbursable").notNull().default(false),
  reimbursedAt: timestamp("reimbursed_at", { withTimezone: true }),
  reference: text("reference"),
  needsReview: boolean("needs_review").notNull().default(false),
  reviewReason: text("review_reason"),
  sourceEmailId: uuid("source_email_id").references(() => emails.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Scheduled pushes. send_at is absolute; it was computed in the job's zone.
export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
  kind: reminderKind("kind").notNull(),
  sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  url: text("url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GoogleAccount = typeof googleAccounts.$inferSelect;
export type Email = typeof emails.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
export type Travel = typeof travel.$inferSelect;
export type NewTravel = typeof travel.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type Reminder = typeof reminders.$inferSelect;
export type NewReminder = typeof reminders.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type JobStatus = Job["status"];
