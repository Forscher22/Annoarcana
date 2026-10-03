import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { asc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { characters } from "../../db/schema.js";
import { requireAdmin, triggerRebuild } from "../../lib/admin-auth.js";

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Lets the Studio add, edit and remove characters on the /characters/ page.
// Pictures uploaded here share the blob store (and /comic-uploads/ URLs) with
// comic pages. The page is built from the database, so changes trigger a rebuild.
export default async (req: Request, context: Context) => {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  const id = context.params.id ? parseInt(context.params.id, 10) : null;
  const store = getStore("comic-pages");

  if (req.method === "GET") {
    const list = await db.select().from(characters).orderBy(asc(characters.position), asc(characters.id));
    return Response.json({ characters: list });
  }

  if (req.method === "DELETE" && id) {
    const [character] = await db.delete(characters).where(eq(characters.id, id)).returning();
    if (!character) return Response.json({ error: "That character no longer exists." }, { status: 404 });
    if (character.imageKey) await store.delete(character.imageKey);
    const rebuilding = await triggerRebuild();
    return Response.json({ deleted: character.id, rebuilding });
  }

  if (req.method === "POST" || (req.method === "PATCH" && id)) {
    const form = await req.formData();
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    const position = parseInt(String(form.get("position") ?? "0"), 10);
    const image = form.get("image");
    const newImage = image instanceof File && image.size > 0 ? image : null;

    if (!name) return Response.json({ error: "Please give the character a name." }, { status: 400 });
    if (!Number.isInteger(position)) {
      return Response.json({ error: "Order must be a whole number." }, { status: 400 });
    }
    if (newImage && !IMAGE_TYPES[newImage.type]) {
      return Response.json({ error: "The picture must be a PNG, JPG, WebP or GIF." }, { status: 400 });
    }

    let existing = null;
    if (req.method === "PATCH") {
      [existing] = await db.select().from(characters).where(eq(characters.id, id!));
      if (!existing) return Response.json({ error: "That character no longer exists." }, { status: 404 });
    }

    let imageFields = {};
    if (newImage) {
      const imageKey = `character-${crypto.randomUUID()}.${IMAGE_TYPES[newImage.type]}`;
      await store.set(imageKey, await newImage.arrayBuffer(), { metadata: { contentType: newImage.type } });
      imageFields = { image: `/comic-uploads/${imageKey}`, imageKey };
    } else if (form.get("removeImage") === "on") {
      imageFields = { image: "", imageKey: null };
    }

    let character;
    if (existing) {
      [character] = await db
        .update(characters)
        .set({ name, description, position, ...imageFields })
        .where(eq(characters.id, existing.id))
        .returning();
      // Clean up the old uploaded picture if it was replaced or removed
      if (existing.imageKey && "image" in imageFields) await store.delete(existing.imageKey);
    } else {
      [character] = await db
        .insert(characters)
        .values({ name, description, position, ...imageFields })
        .returning();
    }

    const rebuilding = await triggerRebuild();
    return Response.json({ character, rebuilding }, { status: existing ? 200 : 201 });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: ["/api/characters", "/api/characters/:id"],
};
