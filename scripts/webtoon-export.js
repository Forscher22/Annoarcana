/**
 * Makes WEBTOON-ready copies of the comic pages in comic/ (their images live
 * in img/comics). Files are named after each page's address, e.g. 31.png for
 * /comic/31/.
 *
 *   npm run webtoon            every page
 *   npm run webtoon -- 54      just page 54
 *   npm run webtoon -- 53a     just interlude 53a
 *   npm run webtoon -- 50 54   pages 50 to 54 (interludes like 53a included)
 *
 * WEBTOON Canvas takes images up to 800px wide and 1280px tall, 2MB each
 * (20MB / 100 images per upload). Each page is resized to 800px wide in sRGB
 * and saved as a lossless PNG; anything taller than 1280px is cut into
 * slices, and a slice that would go over 2MB is saved as a JPEG (quality 95)
 * instead. Files go to webtoon-export/ (not committed). Check WEBTOON's
 * current limits before relying on these numbers.
 */
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const PAGES = process.env.WEBTOON_PAGES || path.join(ROOT, "comic");
const OUT = process.env.WEBTOON_OUT || path.join(__dirname, "..", "webtoon-export");
const WIDTH = 800;
const MAX_HEIGHT = 1280;
const MAX_BYTES = 2 * 1024 * 1024;

// "53a" -> 53, so a range like 50-54 includes the interludes in between
const pageNumber = (name) => parseInt(name, 10);

// The page's image paths from its front matter, e.g. ['/img/comics/31.png']
function pageImages(mdFile) {
  const text = fs.readFileSync(mdFile, "utf8");
  const line = text.match(/^images:\s*\[(.*)\]\s*$/m);
  if (!line) return [];
  return [...line[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

async function exportImage(src, name) {
  const resized = await sharp(src)
    .resize({ width: WIDTH })
    .flatten({ background: "#ffffff" }) // transparent areas can show up black elsewhere
    .toColourspace("srgb")
    .png()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = resized.info;

  const slices = Math.ceil(height / MAX_HEIGHT);
  const written = [];
  for (let i = 0; i < slices; i++) {
    const top = i * MAX_HEIGHT;
    const slice = sharp(resized.data).extract({ left: 0, top, width, height: Math.min(MAX_HEIGHT, height - top) });
    const base = slices > 1 ? `${name}-${i + 1}` : name;
    let data = await slice.clone().png({ compressionLevel: 9 }).toBuffer();
    let ext = "png";
    if (data.length > MAX_BYTES) {
      data = await slice.clone().jpeg({ quality: 95 }).toBuffer();
      ext = "jpg";
    }
    fs.writeFileSync(path.join(OUT, `${base}.${ext}`), data);
    written.push(`${base}.${ext} (${Math.round(data.length / 1024)} KB)`);
  }
  return written;
}

(async () => {
  const args = process.argv.slice(2);
  // A single name like "53a" picks that exact page; numbers pick a range
  const exact = args.length === 1 && !/^\d+$/.test(args[0]) ? args[0] : null;
  const [from, to = from] = exact ? [] : args.map(Number);
  const slugs = fs
    .readdirSync(PAGES)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.parse(f).name)
    .filter((slug) => {
      if (exact) return slug === exact;
      return from === undefined || (pageNumber(slug) >= from && pageNumber(slug) <= to);
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!slugs.length) {
    console.log("No matching pages in comic/.");
    return;
  }
  fs.mkdirSync(OUT, { recursive: true });
  let count = 0;
  for (const slug of slugs) {
    const images = pageImages(path.join(PAGES, `${slug}.md`));
    for (const [i, image] of images.entries()) {
      const src = path.join(ROOT, image);
      if (!image.startsWith("/img/") || !fs.existsSync(src)) {
        console.log(`${slug}: skipped ${image} (not a file in the repo)`);
        continue;
      }
      const name = images.length > 1 ? `${slug}-${String.fromCharCode(97 + i)}` : slug;
      console.log(`${slug} -> ${(await exportImage(src, name)).join(", ")}`);
      count++;
    }
  }
  console.log(`\nDone: ${count} image(s) in webtoon-export/`);
})();
