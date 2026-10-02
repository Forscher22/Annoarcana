import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { comicPages } from "../../db/schema.js";
import { requireAdmin, triggerRebuild } from "../../lib/admin-auth.js";

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Page numbers already used by Markdown files in `comic/`, read from the
// index the site publishes at build time.
async function filePageNumbers(origin: string): Promise<Set<number>> {
  try {
    const res = await fetch(`${origin}/comic-index.json`);
    if (!res.ok) return new Set();
    const pages: { number: number; source: string }[] = await res.json();
    return new Set(pages.filter((p) => p.source === "file").map((p) => p.number));
  } catch {
    return new Set();
  }
}

export default async (req: Request) => {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const id = url.pathname.split("/").filter(Boolean)[2];

  if (req.method === "GET") {
    const pages = await db.select().from(comicPages).orderBy(asc(comicPages.pageNumber));
    return Response.json({
      pages,
      buildHookConfigured: Boolean(process.env.COMIC_BUILD_HOOK_URL),
    });
  }

  if (req.method === "POST" && !id) {
    const form = await req.formData();
    const image = form.get("image");
    const pageNumber = parseInt(String(form.get("pageNumber") ?? ""), 10);
    const chapter = parseInt(String(form.get("chapter") ?? "1"), 10);
    const postedOn = String(form.get("postedOn") ?? "");

    if (!(image instanceof File) || image.size === 0) {
      return Response.json({ error: "Please choose an image for the page." }, { status: 400 });
    }
    const ext = IMAGE_TYPES[image.type];
    if (!ext) {
      return Response.json({ error: "The image must be a PNG, JPG, WebP or GIF." }, { status: 400 });
    }
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      return Response.json({ error: "Page number must be a whole number of 1 or more." }, { status: 400 });
    }
    if (!Number.isInteger(chapter) || chapter < 1) {
      return Response.json({ error: "Chapter must be a whole number of 1 or more." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(postedOn)) {
      return Response.json({ error: "Please pick a posting date." }, { status: 400 });
    }

    const [taken] = await db
      .select({ id: comicPages.id })
      .from(comicPages)
      .where(eq(comicPages.pageNumber, pageNumber));
    if (taken || (await filePageNumbers(url.origin)).has(pageNumber)) {
      return Response.json({ error: `Page ${pageNumber} already exists.` }, { status: 409 });
    }

    const imageKey = `${crypto.randomUUID()}.${ext}`;
    await getStore("comic-pages").set(imageKey, await image.arrayBuffer(), {
      metadata: { contentType: image.type },
    });

    const [page] = await db
      .insert(comicPages)
      .values({
        pageNumber,
        chapter,
        postedOn,
        imageKey,
        title: String(form.get("title") ?? "").trim(),
        alt: String(form.get("alt") ?? "").trim(),
        notes: String(form.get("notes") ?? "").trim(),
        spread: form.get("spread") === "on",
      })
      .returning();

    const rebuilding = await triggerRebuild();
    return Response.json({ page, rebuilding }, { status: 201 });
  }

  if (req.method === "DELETE" && id) {
    const [page] = await db
      .delete(comicPages)
      .where(eq(comicPages.id, parseInt(id, 10)))
      .returning();
    if (!page) {
      return Response.json({ error: "That page no longer exists." }, { status: 404 });
    }
    await getStore("comic-pages").delete(page.imageKey);
    const rebuilding = await triggerRebuild();
    return Response.json({ deleted: page.id, rebuilding });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: ["/api/comic-pages", "/api/comic-pages/:id"],
};
