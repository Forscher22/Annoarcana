CREATE TABLE "news_posts" (
	"id" serial PRIMARY KEY,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"posted_on" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
