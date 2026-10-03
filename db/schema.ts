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

// News posts written in the Studio and shown on the /news/ page.
export const newsPosts = pgTable("news_posts", {
  id: serial().primaryKey(),
  title: text().notNull(),
  body: text().notNull().default(""),
  // YYYY-MM-DD, shown as the post's date
  postedOn: text("posted_on").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Text for the site's simple pages (About, Support, Links, and the intro on
// Characters), written in the Studio. The page's own file is used until a
// section has been saved here.
export const siteSections = pgTable("site_sections", {
  slug: text().primaryKey(),
  body: text().notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Characters shown on the /characters/ page, managed in the Studio.
export const characters = pgTable("characters", {
  id: serial().primaryKey(),
  name: text().notNull(),
  description: text().notNull().default(""),
  // Site path of the picture, e.g. /img/characters/vasilisa.jpg or /comic-uploads/<key>
  image: text().notNull().default(""),
  // Upload key in the `comic-pages` blob store, when the picture was uploaded in the Studio
  imageKey: text("image_key"),
  position: integer().notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
