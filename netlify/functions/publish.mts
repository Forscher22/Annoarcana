import type { Config } from "@netlify/functions";
import { requireAdmin, triggerRebuild } from "../../lib/admin-auth.js";

// Lets the dashboard rebuild the site on demand.
export default async (req: Request) => {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;

  if (!process.env.COMIC_BUILD_HOOK_URL) {
    return Response.json(
      { error: "Automatic publishing isn't set up yet. Add a build hook first." },
      { status: 400 },
    );
  }
  const rebuilding = await triggerRebuild();
  if (!rebuilding) {
    return Response.json({ error: "Netlify didn't accept the rebuild request." }, { status: 502 });
  }
  return Response.json({ rebuilding });
};

export const config: Config = {
  path: "/api/publish",
  method: "POST",
};
