import type { Config } from "@netlify/functions";
import { requireAdmin } from "../../lib/admin-auth.js";
import { backupFileName, makeBackup } from "../../lib/backup.js";

// Lets the Studio download an up-to-date backup on demand.
export default async (req: Request) => {
  const auth = await requireAdmin(req);
  if (auth instanceof Response) return auth;
  const backup = await makeBackup();
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${backupFileName(backup.createdAt)}"`,
      "Cache-Control": "no-store",
    },
  });
};

export const config: Config = {
  path: "/api/backup",
  method: "GET",
};
