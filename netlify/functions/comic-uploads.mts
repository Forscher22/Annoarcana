import type { Config, Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";

// Serves page images uploaded through the dashboard. Each upload gets a
// unique key, so the images can be cached forever.
export default async (req: Request, context: Context) => {
  const { key } = context.params;
  const result = await getStore("comic-pages").getWithMetadata(key, { type: "stream" });
  if (!result) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(result.data, {
    headers: {
      "Content-Type": String(result.metadata.contentType ?? "application/octet-stream"),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};

export const config: Config = {
  path: "/comic-uploads/:key",
  method: "GET",
};
