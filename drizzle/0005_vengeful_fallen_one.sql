CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "companyId" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "companyId" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_logs" ADD COLUMN "companyId" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD COLUMN "companyId" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "companyId" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "companyId" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "time_off_requests" ADD COLUMN "companyId" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "timeclocks" ADD COLUMN "companyId" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "companyId" integer DEFAULT 1 NOT NULL;