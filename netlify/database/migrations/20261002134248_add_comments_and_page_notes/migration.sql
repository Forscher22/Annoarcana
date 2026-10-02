CREATE TABLE "comments" (
	"id" serial PRIMARY KEY,
	"page_number" integer NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"is_author" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_notes" (
	"page_number" integer PRIMARY KEY,
	"notes" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "comments_page_number_idx" ON "comments" ("page_number");