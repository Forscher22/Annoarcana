import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Comic pages uploaded through the /admin/ dashboard. Pages that live as
// Markdown files in `comic/` are not stored here.
export const comicPages = pgTable("comic_pages", {
  id: serial().primaryKey(),
  pageNumber: integer("page_number").notNull().unique(),
  chapter: integer().notNull().default(1),
  title: text().notNull().default(""),
  alt: text().notNull().default(""),
  notes: text().notNull().default(""),
  imageKey: text("image_key").notNull(),
  spread: boolean().notNull().default(false),
  // YYYY-MM-DD, used as the page's posting date
  postedOn: text("posted_on").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
