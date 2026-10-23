import type { Config, Context } from "https://edge.netlify.com";

// When a page has been posted in the Studio since the last deploy, the front
// page shows it instead of the newest built page (see lib/live-pages.ts).
export default async (req: Request, context: Context) => {
  try {
    const res = await fetch(new URL("/api/live-home", req.url));
    if (res.status === 200) return res;
  } catch (error) {
    console.warn(`[live-home] ${(error as Error).message}`);
  }
  return context.next();
};

export const config: Config = {
  path: "/",
};
