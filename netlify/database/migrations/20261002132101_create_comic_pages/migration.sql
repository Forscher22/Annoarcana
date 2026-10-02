CREATE TABLE "comic_pages" (
	"id" serial PRIMARY KEY,
	"page_number" integer NOT NULL UNIQUE,
	"chapter" integer DEFAULT 1 NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"image_key" text NOT NULL,
	"spread" boolean DEFAULT false NOT NULL,
	"posted_on" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
