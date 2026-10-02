import type { Config, Context } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { comicPages, pageNotes } from "../../db/schema.js";
import { requireAdmin, triggerRebuild } from "../../lib/admin-auth.js";

// Lets the Studio write or change the author notes for any page. Notes are
// baked into the site at build time, so saving triggers a rebuild.
export default async (req: Request, context: Context) => {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const pageNumber = parseInt(context.params.page, 10);
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return Response.json({ error: "Unknown page." }, { status: 400 });
  }

  if (req.method === "GET") {
    const [dashboardPage] = await db
      .select({ notes: comicPages.notes })
      .from(comicPages)
      .where(eq(comicPages.pageNumber, pageNumber));
    if (dashboardPage) return Response.json({ notes: dashboardPage.notes });
    const [row] = await db.select().from(pageNotes).where(eq(pageNotes.pageNumber, pageNumber));
    return Response.json({ notes: row?.notes ?? null });
  }

  const { notes = "" } = await req.json().catch(() => ({}));
  const text = String(notes).trim();

  // Pages posted from the Studio keep their notes alongside the page itself
  const [dashboardPage] = await db
    .update(comicPages)
    .set({ notes: text })
    .where(eq(comicPages.pageNumber, pageNumber))
    .returning({ id: comicPages.id });

  if (!dashboardPage) {
    await db
      .insert(pageNotes)
      .values({ pageNumber, notes: text })
      .onConflictDoUpdate({ target: pageNotes.pageNumber, set: { notes: text, updatedAt: new Date() } });
  }

  const rebuilding = await triggerRebuild();
  return Response.json({ notes: text, rebuilding });
};

export const config: Config = {
  path: "/api/page-notes/:page",
  method: ["GET", "PUT"],
};
