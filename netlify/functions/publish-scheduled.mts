import type { Config, Context } from "@netlify/functions";
import { triggerRebuild } from "../../lib/admin-auth.js";

// Publishes scheduled pages. Pages dated in the future are left out of the
// build, and their go-live times are listed in /schedule.json; once one of
// those times has passed, this rebuilds the site so the page appears.
// Needs the COMIC_BUILD_HOOK_URL build hook, like the Studio's Publish button.
export default async (_req: Request, context: Context) => {
  const res = await fetch(new URL("/schedule.json", context.site.url));
  if (!res.ok) {
    console.warn(`[scheduled] Couldn't read schedule.json (${res.status})`);
    return;
  }
  const { due = [] }: { due?: string[] } = await res.json();
  const now = Date.now();
  const ready = due.filter((time) => Date.parse(time) <= now);
  if (!ready.length) return;

  if (await triggerRebuild()) {
    console.log(`[scheduled] Publishing ${ready.length} page(s) that went live at ${ready.join(", ")}`);
  } else {
    console.warn("[scheduled] A page is due but the rebuild couldn't be started (is COMIC_BUILD_HOOK_URL set?)");
  }
};

export const config: Config = {
  schedule: "@hourly",
};
