import type { Config, Context } from "@netlify/functions";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { newsPosts } from "../../db/schema.js";
import { requireAdmin, triggerRebuild } from "../../lib/admin-auth.js";

// Lets the Studio write, edit and delete news posts. Posts are baked into the
// /news/ page at build time, so every change triggers a rebuild.
export default async (req: Request, context: Context) => {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const id = context.params.id ? parseInt(context.params.id, 10) : null;

  if (req.method === "GET") {
    const posts = await db
      .select()
      .from(newsPosts)
      .orderBy(desc(newsPosts.postedOn), desc(newsPosts.id));
    return Response.json({ posts });
  }

  if (req.method === "DELETE" && id) {
    const [post] = await db.delete(newsPosts).where(eq(newsPosts.id, id)).returning();
    if (!post) return Response.json({ error: "That post no longer exists." }, { status: 404 });
    const rebuilding = await triggerRebuild();
    return Response.json({ deleted: post.id, rebuilding });
  }

  if (req.method === "POST" || (req.method === "PUT" && id)) {
    const input = await req.json().catch(() => ({}));
    const title = String(input.title ?? "").trim();
    const body = String(input.body ?? "").trim();
    const postedOn = String(input.postedOn ?? "");

    if (!title) return Response.json({ error: "Please give the post a title." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(postedOn)) {
      return Response.json({ error: "Please pick a date for the post." }, { status: 400 });
    }

    let post;
    if (req.method === "POST") {
      [post] = await db.insert(newsPosts).values({ title, body, postedOn }).returning();
    } else {
      [post] = await db
        .update(newsPosts)
        .set({ title, body, postedOn })
        .where(eq(newsPosts.id, id!))
        .returning();
      if (!post) return Response.json({ error: "That post no longer exists." }, { status: 404 });
    }

    const rebuilding = await triggerRebuild();
    return Response.json({ post, rebuilding }, { status: req.method === "POST" ? 201 : 200 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: ["/api/news", "/api/news/:id"],
};
