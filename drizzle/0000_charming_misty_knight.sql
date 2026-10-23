CREATE TYPE "public"."email_class" AS ENUM('new_booking', 'update', 'travel', 'payment', 'irrelevant');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('to_invoice', 'invoiced', 'paid');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('option_1', 'option_2', 'confirmed', 'cancelled', 'wrapped');--> statement-breakpoint
CREATE TYPE "public"."reminder_kind" AS ENUM('new_booking', 'job_changed', 'night_before', 'call_time', 'invoice_due', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."travel_kind" AS ENUM('flight', 'hotel', 'car');--> statement-breakpoint
CREATE TABLE "emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gmail_id" text NOT NULL,
	"thread_id" text NOT NULL,
	"from" text NOT NULL,
	"subject" text NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"classified_as" "email_class",
	"processed_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "emails_gmail_id_unique" UNIQUE("gmail_id")
);
--> statement-breakpoint
CREATE TABLE "google_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"last_history_id" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "google_accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"amount" numeric(12, 2),
	"currency" text,
	"sent_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"status" "invoice_status" DEFAULT 'to_invoice' NOT NULL,
	"source_email_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client" text,
	"agency" text,
	"booker" text,
	"job_type" text,
	"status" "job_status" DEFAULT 'option_1' NOT NULL,
	"start_date" date,
	"end_date" date,
	"call_time" time,
	"wrap_time" time,
	"location" text,
	"timezone" text,
	"day_rate" numeric(12, 2),
	"currency" text,
	"usage" text,
	"notes" text,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_reason" text,
	"thread_id" text,
	"source_email_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"kind" "reminder_kind" NOT NULL,
	"send_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "travel" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"kind" "travel_kind" NOT NULL,
	"from" text,
	"to" text,
	"depart_at" timestamp with time zone,
	"arrive_at" timestamp with time zone,
	"reference" text,
	"thread_id" text,
	"source_email_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_source_email_id_emails_id_fk" FOREIGN KEY ("source_email_id") REFERENCES "public"."emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_source_email_id_emails_id_fk" FOREIGN KEY ("source_email_id") REFERENCES "public"."emails"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel" ADD CONSTRAINT "travel_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel" ADD CONSTRAINT "travel_source_email_id_emails_id_fk" FOREIGN KEY ("source_email_id") REFERENCES "public"."emails"("id") ON DELETE no action ON UPDATE no action;