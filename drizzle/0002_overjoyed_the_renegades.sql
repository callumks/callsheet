CREATE TYPE "public"."expense_kind" AS ENUM('flight', 'hotel', 'transport', 'food', 'kit', 'other');--> statement-breakpoint
ALTER TYPE "public"."email_class" ADD VALUE 'expense' BEFORE 'irrelevant';--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"kind" "expense_kind" NOT NULL,
	"description" text,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text,
	"incurred_on" date NOT NULL,
	"reimbursable" boolean DEFAULT false NOT NULL,
	"reimbursed_at" timestamp with time zone,
	"reference" text,
	"needs_review" boolean DEFAULT false NOT NULL,
	"review_reason" text,
	"source_email_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_source_email_id_emails_id_fk" FOREIGN KEY ("source_email_id") REFERENCES "public"."emails"("id") ON DELETE no action ON UPDATE no action;