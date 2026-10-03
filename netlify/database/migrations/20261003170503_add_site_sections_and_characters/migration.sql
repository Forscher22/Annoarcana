CREATE TABLE "characters" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"image" text DEFAULT '' NOT NULL,
	"image_key" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_sections" (
	"slug" text PRIMARY KEY,
	"body" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
INSERT INTO "characters" ("name", "description", "image", "position") VALUES
	('Vasilisa', 'Vasilisa dreams of running away and starting a new, boring life. She''s just an average girl — not a witch!', '/img/characters/vasilisa.jpg', 1),
	('Jakub', 'Childhood and best friend to Vasilisa.', '/img/characters/jakub.jpg', 2),
	('???', 'Who the hell does he think he is???', '/img/characters/mateusz.jpg', 3),
	('Aleks / Aleksandra', 'A mysterious and perhaps too charming rogue.', '/img/characters/aleks.jpg', 4),
	('Motanka', 'A gift from Vasilisa''s mother. Just??? A doll???', '/img/characters/motanka.jpg', 5);
