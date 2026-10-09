/**
 * This is the 11ty config! If you ever need to get underneath the hood of 11ty
 * to add functionality or to sort your collections, this would be the place to
 * do it! In this example however, we just copy over the `img` and `css`
 * folders over to the output.
 * (https://www.11ty.dev/docs/config/)
 */

/** @param {import("@11ty/eleventy").UserConfig} eleventyConfig */

const fs = require("node:fs");
const path = require("node:path");
const Image = require("@11ty/eleventy-img");
const { eleventyImageTransformPlugin } = Image;
const pluginRss = require("@11ty/eleventy-plugin-rss");

/**
 * Pages uploaded through the /admin/ dashboard live in Netlify Database rather
 * than as Markdown files. If the database can't be reached (e.g. on the very
 * first deploy, before its table exists), the site still builds with just the
 * Markdown pages.
 */
async function getDashboardPages() {
	try {
		const { getDatabase } = await import("@netlify/database");
		const db = getDatabase();
		return await db.sql`SELECT * FROM comic_pages ORDER BY page_number`;
	} catch (error) {
		console.warn(`[comic] Skipping dashboard pages: ${error.message}`);
		return [];
	}
}

// Author notes written in the Studio for Markdown-file pages, keyed by page number
async function getStudioNotes() {
	try {
		const { getDatabase } = await import("@netlify/database");
		const rows = await getDatabase().sql`SELECT page_number, notes FROM page_notes`;
		return Object.fromEntries(rows.filter((r) => r.notes).map((r) => [r.page_number, r.notes]));
	} catch (error) {
		console.warn(`[comic] Skipping Studio notes: ${error.message}`);
		return {};
	}
}

// News posts written in the Studio, newest first
async function getNewsPosts() {
	try {
		const { getDatabase } = await import("@netlify/database");
		return await getDatabase().sql`SELECT * FROM news_posts ORDER BY posted_on DESC, id DESC`;
	} catch (error) {
		console.warn(`[comic] Skipping news posts: ${error.message}`);
		return [];
	}
}

/**
 * Simple pages whose text can be edited in the Studio. Until a section is
 * saved there, its text comes from the file listed here (front matter removed).
 */
const SECTION_FILES = {
	about: "about.md",
	characters: "_includes/sections/characters-intro.md",
	support: "support.md",
	links: "links.md",
};

function getSectionDefaults() {
	return Object.fromEntries(
		Object.entries(SECTION_FILES).map(([slug, file]) => {
			const text = fs.readFileSync(path.join(__dirname, file), "utf8");
			return [slug, text.replace(/^---[\s\S]*?\n---\s*\n?/, "").trim()];
		}),
	);
}

async function getSiteSections() {
	try {
		const { getDatabase } = await import("@netlify/database");
		const rows = await getDatabase().sql`SELECT slug, body FROM site_sections`;
		return Object.fromEntries(rows.map((r) => [r.slug, r.body]));
	} catch (error) {
		console.warn(`[comic] Skipping Studio page text: ${error.message}`);
		return {};
	}
}

// Characters managed in the Studio. Returns null if the database can't be
// reached, so the page can say so instead of looking empty.
async function getCharacters() {
	try {
		const { getDatabase } = await import("@netlify/database");
		return await getDatabase().sql`SELECT * FROM characters ORDER BY position, id`;
	} catch (error) {
		console.warn(`[comic] Skipping characters: ${error.message}`);
		return null;
	}
}

// Quality for every resized image (comic pages, share images, nav buttons).
// 95 keeps the brush grain and faint sketch lines that lower settings smooth
// over, while pages stay about 6x smaller than the original PNGs.
const IMAGE_QUALITY = {
	sharpWebpOptions: { quality: 95 },
	sharpJpegOptions: { quality: 95 },
};

/**
 * Scheduled pages: a comic page dated in the future is left out of the build
 * until its date (at `publishTimeUTC` from _data/metadata.json) has passed.
 * The dates of waiting pages are written to /schedule.json, which the
 * publish-scheduled function checks every hour to rebuild the site when one
 * is due.
 */
const { publishTimeUTC = "00:00" } = require("./_data/metadata.json");

function goesLiveAt(date) {
	const day = new Date(date);
	if (Number.isNaN(day.getTime())) return null;
	const [hours, minutes] = publishTimeUTC.split(":").map(Number);
	return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hours || 0, minutes || 0));
}

module.exports = async function(eleventyConfig) {
		// inputPath -> when that page goes live, for pages still waiting
		const scheduled = new Map();
		eleventyConfig.addPreprocessor("scheduled-pages", "*", (data) => {
			if (!data.page?.inputPath?.startsWith("./comic/")) return;
			const liveAt = goesLiveAt(data.date ?? data.page.date);
			if (liveAt && liveAt > new Date()) {
				scheduled.set(data.page.inputPath, liveAt);
				return false;
			}
			scheduled.delete(data.page.inputPath);
		});
		eleventyConfig.on("eleventy.after", ({ directories }) => {
			// Only the dates, so nothing about upcoming pages is given away
			const due = [...scheduled.values()].sort((a, b) => a - b).map((d) => d.toISOString());
			fs.writeFileSync(path.join(directories.output, "schedule.json"), JSON.stringify({ due }));
		});

		// Copy `img` and `css` folders to output
		// The full-size comic pages in img/comics are only the masters that the
		// resized copies are built from, so they aren't published themselves
		eleventyConfig.addPassthroughCopy("img", { filter: ["**", "!comics/**"] });
		eleventyConfig.addPassthroughCopy("css");
		eleventyConfig.addPassthroughCopy("js");
		eleventyConfig.addPassthroughCopy("robots.txt");
		// The template's setup guide is for the repo, not for readers
		eleventyConfig.ignores.add("readme.md");
		// Saved copies of the old ComicFury pages, kept for reference only.
		// archive.html would otherwise collide with archive.liquid at /archive/
		eleventyConfig.ignores.add("archive.html");
		eleventyConfig.ignores.add("Links.html");
		eleventyConfig.ignores.add("Supportus.html");
		eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
			// Resized copies go in their own folder: their file names change
			// whenever the image does, so netlify.toml can cache them for a year
			urlPath: "/img/r/",
			outputDir: path.join(eleventyConfig.directories.output, "img", "r"),
			widths: [100, "auto"],
			...IMAGE_QUALITY,
			defaultAttributes: {
			  loading: 'lazy'
			}
		});
		eleventyConfig.addPlugin(pluginRss);

		// The picture shown when a page is shared (Discord, Bluesky, X, ...).
		// Images in the repo get a 1200px-wide JPEG copy, since the originals
		// are too big for some sites to show; pages uploaded through the
		// dashboard aren't on disk at build time, so they use the upload itself.
		eleventyConfig.addAsyncFilter("shareImage", async function(src) {
			const local = path.join(__dirname, src);
			if (!src.startsWith("/img/") || !fs.existsSync(local)) {
				return { url: src };
			}
			const stats = await Image(local, {
				widths: [1200],
				formats: ["jpeg"],
				...IMAGE_QUALITY,
				outputDir: path.join(eleventyConfig.directories.output, "img", "share"),
				urlPath: "/img/share/",
			});
			const { url, width, height } = stats.jpeg[0];
			return { url, width, height };
		});

		// A small thumbnail for the Studio's page list (see comic-index.liquid)
		eleventyConfig.addAsyncFilter("thumbImage", async function(src) {
			const local = path.join(__dirname, src);
			if (!src.startsWith("/img/") || !fs.existsSync(local)) return src;
			const stats = await Image(local, {
				widths: [120],
				formats: ["jpeg"],
				...IMAGE_QUALITY,
				outputDir: path.join(eleventyConfig.directories.output, "img", "r"),
				urlPath: "/img/r/",
			});
			return stats.jpeg[0].url;
		});

		// Add each dashboard page as if it were a file in `comic/`, so it gets the
		// same layout, ordering and navigation as the Markdown pages. A Markdown
		// file with the same page number takes priority.
		for (const row of await getDashboardPages()) {
			const slug = String(row.page_number).padStart(2, "0");
			if (fs.existsSync(path.join(__dirname, "comic", `${slug}.md`))) continue;
			eleventyConfig.addTemplate(`comic/${slug}.md`, row.notes, {
				...(row.title ? { title: row.title } : {}),
				images: [`/comic-uploads/${row.image_key}`],
				alt: row.alt,
				date: row.posted_on,
				tags: [`chapter${row.chapter}`],
				spread: row.spread,
				dashboardId: row.id,
				// Author notes are plain Markdown; don't run them through Liquid
				templateEngineOverride: "md",
			});
		}

		eleventyConfig.addGlobalData("pageNotes", await getStudioNotes());
		eleventyConfig.addGlobalData("news", await getNewsPosts());
		const sectionDefaults = getSectionDefaults();
		eleventyConfig.addGlobalData("sectionDefaults", sectionDefaults);
		eleventyConfig.addGlobalData("sections", { ...sectionDefaults, ...(await getSiteSections()) });
		eleventyConfig.addGlobalData("characters", await getCharacters());

		// Renders Studio notes; raw HTML is turned off so notes can't break the page
		const notesMarkdown = require("markdown-it")({ html: false, linkify: true, breaks: true });
		eleventyConfig.addFilter("markdown", (value) => notesMarkdown.render(String(value ?? "")));

		// Bundle the dashboard script (it uses the @netlify/identity package)
		eleventyConfig.on("eleventy.before", async ({ directories }) => {
			await require("esbuild").build({
				entryPoints: [path.join(__dirname, "admin", "admin.js")],
				outfile: path.join(directories.output, "admin", "admin.js"),
				bundle: true,
				format: "esm",
				minify: true,
				logLevel: "warning",
			});
		});
		eleventyConfig.addLiquidFilter("utcDate", function(value) { 
			const utc= (new Date(value)).toUTCString().split(' ');
			return `${utc[2]} ${utc[1]}, ${utc[3]}`;
		});
		// Chapters that have pages, each with its pages in reading order, for the
		// one-page chapter readers (chapter-read.liquid)
		const chapterNameList = require("./_data/chapterNames.json");
		eleventyConfig.addCollection("chapterReads", (api) =>
			chapterNameList
				.map((ch) => ({ ...ch, pages: api.getFilteredByTag(`chapter${ch.number}`) }))
				.filter((ch) => ch.pages.length),
		);
		eleventyConfig.addAsyncFilter("chapters", async function(collections) { 
			// Sort chapters numerically so chapter10 comes after chapter9
			return Object.keys(collections)
				.filter((propertyName) => /^chapter\d+$/.test(propertyName))
				.sort((a, b) => parseInt(a.slice(7)) - parseInt(b.slice(7)));
		});		
}









