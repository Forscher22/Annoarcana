import type { Config } from "@netlify/functions";
import { getUser } from "@netlify/identity";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db } from "../../db/index.js";
import { comments } from "../../db/schema.js";
import { requireAdmin } from "../../lib/admin-auth.js";

const MAX_NAME = 60;
const MAX_BODY = 2000;

// Reader comments on comic pages. Anyone can read and post; deleting (and the
// Studio's "recent comments" list) is admin-only.
export default async (req: Request) => {
  const url = new URL(req.url);
  const id = url.pathname.split("/").filter(Boolean)[2];

  if (req.method === "GET") {
    if (url.searchParams.has("recent")) {
      const auth = await requireAdmin(req);
      if (auth instanceof Response) return auth;
      const recent = await db.select().from(comments).orderBy(desc(comments.createdAt)).limit(50);
      return Response.json({ comments: recent });
    }

    const page = parseInt(url.searchParams.get("page") ?? "", 10);
    if (!Number.isInteger(page)) {
      return Response.json({ error: "Missing page number." }, { status: 400 });
    }
    const list = await db
      .select({
        id: comments.id,
        name: comments.name,
        body: comments.body,
        isAuthor: comments.isAuthor,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(eq(comments.pageNumber, page))
      .orderBy(asc(comments.createdAt));
    return Response.json({ comments: list }, { headers: { "Cache-Control": "no-store" } });
  }

  if (req.method === "POST" && !id) {
    if (req.headers.get("origin") !== url.origin) {
      return Response.json({ error: "Request origin not allowed." }, { status: 403 });
    }
    const input = await req.json().catch(() => ({}));

    // Bots tend to fill in every field, including this hidden one
    if (input.website) return Response.json({ ok: true }, { status: 201 });

    const page = parseInt(String(input.page ?? ""), 10);
    const name = String(input.name ?? "").trim();
    const body = String(input.body ?? "").trim();
    if (!Number.isInteger(page) || page < 1) {
      return Response.json({ error: "Missing page number." }, { status: 400 });
    }
    if (!name || name.length > MAX_NAME) {
      return Response.json({ error: `Please enter a name (up to ${MAX_NAME} characters).` }, { status: 400 });
    }
    if (!body || body.length > MAX_BODY) {
      return Response.json({ error: `Comments can be up to ${MAX_BODY} characters.` }, { status: 400 });
    }

    // Stop the same comment being posted twice in a row
    const [duplicate] = await db
      .select({ id: comments.id })
      .from(comments)
      .where(
        and(
          eq(comments.pageNumber, page),
          eq(comments.body, body),
          gt(comments.createdAt, new Date(Date.now() - 10 * 60 * 1000)),
        ),
      );
    if (duplicate) {
      return Response.json({ error: "Looks like that comment was already posted." }, { status: 409 });
    }

    const user = await getUser();
    const [comment] = await db
      .insert(comments)
      .values({ pageNumber: page, name, body, isAuthor: Boolean(user?.roles?.includes("admin")) })
      .returning({
        id: comments.id,
        name: comments.name,
        body: comments.body,
        isAuthor: comments.isAuthor,
        createdAt: comments.createdAt,
      });
    return Response.json({ comment }, { status: 201 });
  }

  if (req.method === "DELETE" && id) {
    const auth = await requireAdmin(req);
    if (auth instanceof Response) return auth;
    const [deleted] = await db
      .delete(comments)
      .where(eq(comments.id, parseInt(id, 10)))
      .returning({ id: comments.id });
    if (!deleted) return Response.json({ error: "That comment no longer exists." }, { status: 404 });
    return Response.json({ deleted: deleted.id });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: ["/api/comments", "/api/comments/:id"],
};
