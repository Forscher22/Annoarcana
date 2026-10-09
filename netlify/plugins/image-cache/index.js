// Keeps the resized images between Netlify builds. Their file names are
// content hashes and eleventy-img skips any output that already exists, so
// with the cache restored only new or changed pages get processed.
const DIRS = ["_site/img/r", "_site/img/share"];

module.exports = {
  async onPreBuild({ utils }) {
    for (const dir of DIRS) {
      if (await utils.cache.restore(dir)) console.log(`Restored ${dir} from the build cache`);
    }
  },

  async onPostBuild({ utils }) {
    for (const dir of DIRS) {
      if (await utils.cache.save(dir)) console.log(`Saved ${dir} to the build cache`);
    }
  },
};
