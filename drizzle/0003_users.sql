CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "emails" DROP CONSTRAINT "emails_gmail_id_unique";--> statement-breakpoint
ALTER TABLE "emails" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "google_accounts" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "google_accounts" ADD COLUMN "needs_reconnect" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "travel" ADD COLUMN "user_id" uuid;--> statement-breakpoint
-- Existing data belongs to whoever connected Gmail before there were users.
INSERT INTO "users" ("email", "created_at") SELECT lower("email"), "created_at" FROM "google_accounts" ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "google_accounts" g SET "user_id" = u."id" FROM "users" u WHERE u."email" = lower(g."email");--> statement-breakpoint
UPDATE "emails" SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "expenses" SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "invoices" SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "jobs" SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "push_subscriptions" SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "reminders" SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "travel" SET "user_id" = (SELECT "id" FROM "users" ORDER BY "created_at" LIMIT 1) WHERE "user_id" IS NULL;--> statement-breakpoint
-- Only when nobody ever connected Gmail are rows still unowned: test or seed data with no one to own it.
DELETE FROM "reminders" WHERE "user_id" IS NULL;--> statement-breakpoint
DELETE FROM "invoices" WHERE "user_id" IS NULL;--> statement-breakpoint
DELETE FROM "expenses" WHERE "user_id" IS NULL;--> statement-breakpoint
DELETE FROM "travel" WHERE "user_id" IS NULL;--> statement-breakpoint
DELETE FROM "jobs" WHERE "user_id" IS NULL;--> statement-breakpoint
DELETE FROM "emails" WHERE "user_id" IS NULL;--> statement-breakpoint
DELETE FROM "push_subscriptions" WHERE "user_id" IS NULL;--> statement-breakpoint
ALTER TABLE "emails" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "google_accounts" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reminders" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "travel" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_accounts" ADD CONSTRAINT "google_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel" ADD CONSTRAINT "travel_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_user_gmail_id" UNIQUE("user_id","gmail_id");--> statement-breakpoint
ALTER TABLE "google_accounts" ADD CONSTRAINT "google_accounts_user_id_unique" UNIQUE("user_id");