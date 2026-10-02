import { boolean, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

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

// Reader comments, attached to a comic page by its page number.
export const comments = pgTable(
  "comments",
  {
    id: serial().primaryKey(),
    pageNumber: integer("page_number").notNull(),
    name: text().notNull(),
    body: text().notNull(),
    // Posted while logged in to the Studio as an admin
    isAuthor: boolean("is_author").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("comments_page_number_idx").on(table.pageNumber)],
);

// Author notes written in the Studio for pages that are Markdown files in
// `comic/` (dashboard pages keep their notes on `comic_pages.notes`).
export const pageNotes = pgTable("page_notes", {
  pageNumber: integer("page_number").primaryKey(),
  notes: text().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
