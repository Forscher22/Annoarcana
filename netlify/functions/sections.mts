import type { Config, Context } from "@netlify/functions";
import { db } from "../../db/index.js";
import { siteSections } from "../../db/schema.js";
import { requireAdmin, triggerRebuild } from "../../lib/admin-auth.js";

// The pages whose text can be edited in the Studio
const SECTIONS = ["about", "characters", "support", "links"];

// Lets the Studio read and save the text of the site's simple pages. The text
// is baked into the site at build time, so saving triggers a rebuild.
export default async (req: Request, context: Context) => {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  if (req.method === "GET") {
    const rows = await db.select().from(siteSections);
    return Response.json({ sections: Object.fromEntries(rows.map((r) => [r.slug, r.body])) });
  }

  const slug = context.params.slug;
  if (!SECTIONS.includes(slug)) {
    return Response.json({ error: "Unknown page." }, { status: 404 });
  }

  const { body = "" } = await req.json().catch(() => ({}));
  const text = String(body).trim();
  await db
    .insert(siteSections)
    .values({ slug, body: text })
    .onConflictDoUpdate({ target: siteSections.slug, set: { body: text, updatedAt: new Date() } });

  const rebuilding = await triggerRebuild();
  return Response.json({ body: text, rebuilding });
};

export const config: Config = {
  path: ["/api/sections", "/api/sections/:slug"],
  method: ["GET", "PUT"],
};
