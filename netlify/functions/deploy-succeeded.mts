import fs from "node:fs";
import path from "node:path";
import type { DeploySucceededEvent } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { triggerRebuild } from "../../lib/admin-auth.js";

// Netlify applies database migrations just before a deploy is published, after
// the site has already been built. Pages baked from the database (characters,
// news, Studio page text) would then show the old data, so when a production
// deploy brings new migrations, rebuild once more to pick up their changes.
// The rebuild carries the same migrations, so it doesn't trigger another one.
export default {
  async deploySucceeded({ deploy }: DeploySucceededEvent) {
    if (deploy.context !== "production") return;

    let latest: string | undefined;
    try {
      const dir = path.join(process.cwd(), "netlify", "database", "migrations");
      latest = fs.readdirSync(dir).sort().at(-1);
    } catch (error) {
      console.warn(`[comic] Couldn't read migrations: ${(error as Error).message}`);
      return;
    }
    if (!latest) return;

    const store = getStore("deploy-state");
    if ((await store.get("latest-migration")) === latest) return;

    if (await triggerRebuild()) {
      await store.set("latest-migration", latest);
      console.log(`[comic] Rebuilding to pick up migration ${latest}`);
    }
  },
};
