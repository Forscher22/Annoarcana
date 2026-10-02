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
const { eleventyImageTransformPlugin } = require("@11ty/eleventy-img");
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

module.exports = async function(eleventyConfig) {
		// Copy `img` and `css` folders to output
		eleventyConfig.addPassthroughCopy("img");
		eleventyConfig.addPassthroughCopy("css");
		eleventyConfig.addPassthroughCopy("js");
		eleventyConfig.addPassthroughCopy("robots.txt");
		eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
			widths: [100, "auto"], 
			defaultAttributes: {
			  loading: 'lazy'
			}
		});
		eleventyConfig.addPlugin(pluginRss);

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
		eleventyConfig.addAsyncFilter("chapters", async function(collections) { 
			// Sort chapters numerically so chapter10 comes after chapter9
			return Object.keys(collections)
				.filter((propertyName) => /^chapter\d+$/.test(propertyName))
				.sort((a, b) => parseInt(a.slice(7)) - parseInt(b.slice(7)));
		});		
}









