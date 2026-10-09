import { getStore } from "@netlify/blobs";
import { db } from "../db/index.js";
import { characters, comicPages, comments, newsPosts, pageNotes, siteSections } from "../db/schema.js";

// Everything the Studio and readers add lives in the database rather than the
// repo: comments, news, characters, page notes, page text and Studio-posted
// pages. A backup is all of it as one JSON file. (Images uploaded in the
// Studio stay in the `comic-pages` blob store; the backup records their keys.)
export async function makeBackup() {
  const [commentRows, newsRows, characterRows, noteRows, sectionRows, pageRows] = await Promise.all([
    db.select().from(comments),
    db.select().from(newsPosts),
    db.select().from(characters),
    db.select().from(pageNotes),
    db.select().from(siteSections),
    db.select().from(comicPages),
  ]);
  return {
    createdAt: new Date().toISOString(),
    tables: {
      comments: commentRows,
      news_posts: newsRows,
      characters: characterRows,
      page_notes: noteRows,
      site_sections: sectionRows,
      comic_pages: pageRows,
    },
  };
}

export const backupFileName = (createdAt: string) => `anno-arcana-backup-${createdAt.slice(0, 10)}.json`;

const KEEP = 12;

// Saves a backup in the `backups` blob store and keeps the newest twelve.
export async function storeBackup(backup: Awaited<ReturnType<typeof makeBackup>>) {
  const store = getStore("backups");
  const key = backupFileName(backup.createdAt);
  await store.setJSON(key, backup);
  const { blobs } = await store.list();
  const old = blobs.map((b) => b.key).sort().slice(0, -KEEP);
  await Promise.all(old.map((k) => store.delete(k)));
  return key;
}
