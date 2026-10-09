import type { Config } from "@netlify/functions";
import { backupFileName, makeBackup, storeBackup } from "../../lib/backup.js";

// Weekly backup of the database (comments, news, characters, notes, page text,
// Studio pages). It's kept in Netlify Blobs, and if DISCORD_BACKUP_WEBHOOK_URL
// is set, the file is also posted to that Discord channel so a copy lives
// outside Netlify.
export default async () => {
  const backup = await makeBackup();
  const key = await storeBackup(backup);
  const counts = Object.entries(backup.tables).map(([name, rows]) => `${name}: ${rows.length}`).join(", ");
  console.log(`[backup] Saved ${key} (${counts})`);

  const webhook = process.env.DISCORD_BACKUP_WEBHOOK_URL;
  if (!webhook) return;
  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({ username: "Anno Arcana backups", content: `Weekly backup: ${counts}`, allowed_mentions: { parse: [] } }),
  );
  form.append(
    "files[0]",
    new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    backupFileName(backup.createdAt),
  );
  try {
    const res = await fetch(webhook, { method: "POST", body: form, signal: AbortSignal.timeout(15000) });
    if (!res.ok) console.warn(`[backup] Discord rejected the backup (${res.status})`);
  } catch (error) {
    console.warn(`[backup] Couldn't post the backup to Discord: ${(error as Error).message}`);
  }
};

export const config: Config = {
  schedule: "@weekly",
};
