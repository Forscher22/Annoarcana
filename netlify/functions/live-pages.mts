import type { Config, Context } from "@netlify/functions";
import { cacheHeaders, getBuiltPages, getLivePages, renderLivePage } from "../../lib/live-pages.js";

// Shows Studio pages that went up after the last deploy (see lib/live-pages.ts).
// - /comic/<number>/: the page itself. Pages in the build are served as
//   files and never reach this function.
// - /api/live-pages: the list of them, for the "Next" link on the newest
//   built page (js/live-pages.js).
// - /api/live-home: the newest of them as the front page, or 204 when there
//   are none (used by netlify/edge-functions/live-home.ts).
export default async (req: Request, context: Context) => {
  const { origin, pathname } = new URL(req.url);
  const built = await getBuiltPages(origin);
  const live = await getLivePages(built);

  if (pathname === "/api/live-pages") {
    const pages = live.map((p) => ({ number: p.pageNumber, url: p.url, title: p.title }));
    return new Response(JSON.stringify(pages), { headers: cacheHeaders("application/json") });
  }

  const page =
    pathname === "/api/live-home"
      ? live.at(-1)
      : live.find((p) => p.url === `/comic/${context.params.slug}/`);
  if (!page) {
    if (pathname === "/api/live-home") return new Response(null, { status: 204, headers: cacheHeaders("text/plain") });
    const notFound = await fetch(new URL("/404.html", origin));
    return new Response(notFound.ok ? notFound.body : "Not found", {
      status: 404,
      headers: cacheHeaders("text/html; charset=utf-8"),
    });
  }

  const template = await fetch(new URL("/live-page-template/", origin));
  if (!template.ok) throw new Error(`The live page template returned ${template.status}`);
  const html = renderLivePage(await template.text(), built, live, page, pathname === "/api/live-home");
  return new Response(html, { headers: cacheHeaders("text/html; charset=utf-8") });
};

export const config: Config = {
  path: ["/comic/:slug", "/comic/:slug/", "/api/live-pages", "/api/live-home"],
  method: "GET",
  // Built pages are files, which take priority over this function
  preferStatic: true,
};
