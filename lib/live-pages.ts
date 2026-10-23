import { asc } from "drizzle-orm";
import markdownIt from "markdown-it";
import { db } from "../db/index.js";
import { comicPages } from "../db/schema.js";
import chapterNames from "../_data/chapterNames.json";
import metadata from "../_data/metadata.json";

// Pages posted in the Studio go up straight away, without waiting for the
// site to be rebuilt: until a deploy bakes them in, they're served from the
// database by netlify/functions/live-pages.mts.

export type BuiltPage = { number: number; url: string; title: string };
export type LivePage = typeof comicPages.$inferSelect & { url: string };

// Responses are cached on the CDN under this tag; the Studio clears it
// whenever a page changes, and every deploy clears it too.
export const LIVE_CACHE_TAG = "live-pages";

export function cacheHeaders(type: string) {
  return {
    "Content-Type": type,
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-CDN-Cache-Control": "public, max-age=300, durable",
    "Cache-Tag": LIVE_CACHE_TAG,
  };
}

export function pageUrl(number: number) {
  return `/comic/${String(number).padStart(2, "0")}/`;
}

// Same rule as the build (eleventy.config.js): a page goes live on its date
// at `publishTimeUTC`.
function isLive(postedOn: string, now = Date.now()) {
  const [hours, minutes] = (metadata.publishTimeUTC ?? "00:00").split(":").map(Number);
  const [y, m, d] = postedOn.split("-").map(Number);
  return Date.UTC(y, m - 1, d, hours || 0, minutes || 0) <= now;
}

// Pages in the current build, in reading order
export async function getBuiltPages(origin: string): Promise<BuiltPage[]> {
  const res = await fetch(new URL("/comic-index.json", origin));
  if (!res.ok) throw new Error(`comic-index.json returned ${res.status}`);
  return res.json();
}

// Studio pages that are due but not in the build yet, oldest first
export async function getLivePages(built: BuiltPage[]): Promise<LivePage[]> {
  const builtUrls = new Set(built.map((p) => p.url));
  const rows = await db.select().from(comicPages).orderBy(asc(comicPages.postedOn), asc(comicPages.pageNumber));
  return rows
    .map((row) => ({ ...row, url: pageUrl(row.pageNumber) }))
    .filter((row) => !builtUrls.has(row.url) && isLive(row.postedOn));
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
// Matches Liquid's url_encode filter, which the template's share links use
const urlEncode = (value: string) => encodeURIComponent(value).replace(/%20/g, "+");

const notesMarkdown = markdownIt({ html: false, linkify: true, breaks: true });

function navLink(url: string, name: string, label: string) {
  return `<a href="${escapeHtml(url)}"><img src="/img/comicnav/nav_${name}.png" alt="" loading="eager"><span>${label}</span></a>`;
}

// Fills in the live-page template (live-page.liquid) for one page.
// `home` renders it as the front page, with a "Start from page one" link.
export function renderLivePage(template: string, built: BuiltPage[], live: LivePage[], page: LivePage, home = false) {
  const all = [...built.map((p) => p.url), ...live.map((p) => p.url)];
  const index = all.indexOf(page.url);
  const first = all[0];
  const previous = all[index - 1];
  const next = all[index + 1];
  const last = all.at(-1);

  const nav = [
    first && first !== page.url ? navLink(first, "first", "First") : "",
    previous ? navLink(previous, "previous", "Previous") : "",
    next ? navLink(next, "next", "Next") : "",
    last && last !== page.url ? navLink(last, "last", "Latest") : "",
  ].join("\n  ");
  const keyNav = `<script>
  document.addEventListener("keydown", (e) => {
    const target = e.target;
    if (target.closest && target.closest("input, textarea, select, [contenteditable]")) return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const to = { ArrowRight: ${JSON.stringify(next ?? "")}, ArrowLeft: ${JSON.stringify(previous ?? "")} }[e.key];
    if (to) window.location.href = to;
  });
</script>`;

  const title = page.title || `Page ${String(page.pageNumber).padStart(2, "0")}`;
  const chapter = chapterNames.find((ch) => ch.number === page.chapter)?.name;
  const headTitle = chapter ? `${title} – ${chapter}` : title;
  const image = `/comic-uploads/${page.imageKey}`;
  const img = `<img src="${escapeHtml(image)}" alt="${escapeHtml(page.alt)}" fetchpriority="high">`;
  const [, day, month, year] = new Date(`${page.postedOn}T00:00:00Z`).toUTCString().split(" ");
  const description = page.alt.replace(/\s+/g, " ").trim();
  const url = home ? "/" : page.url;

  const values: Record<string, string> = {
    "%%NAV%%": `<div class="comicNav">\n  ${nav}\n</div>\n${keyNav}`,
    "%%START%%": home && first !== page.url ? `<a class="start-reading" href="${escapeHtml(first)}">Start from page one</a>` : "",
    "%%IMAGES%%": next ? `<a href="${escapeHtml(next)}">${img}</a>` : img,
    "%%SPREADCLASS%%": page.spread ? " double-page" : "",
    "%%HEADTITLE%%": escapeHtml(headTitle),
    "%%TITLE%%": escapeHtml(title),
    "%%ALT%%": escapeHtml(description.length > 160 ? `${description.slice(0, 157)}...` : description),
    "%%IMAGE%%": escapeHtml(image),
    "%%URL%%": escapeHtml(page.url),
    "%%DATE%%": `${month} ${day}, ${year}`,
    "%%NOTES%%": page.notes ? notesMarkdown.render(page.notes) : "",
    "%%NUMBER%%": String(page.pageNumber),
    // Share links: the title and address, as encoded by url_encode
    [urlEncode("%%TITLE%%")]: urlEncode(title),
    // Share links point at the page itself, even on the front page
    [urlEncode("/live-page-template/")]: urlEncode(page.url),
    [`data-share-url="${metadata.base}/live-page-template/"`]: `data-share-url="${metadata.base}${page.url}"`,
    "/live-page-template/": url,
  };
  let html = template;
  for (const [token, value] of Object.entries(values)) {
    html = html.split(token).join(value);
  }
  return html;
}
