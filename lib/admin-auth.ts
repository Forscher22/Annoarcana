import { getUser, verifyRequestOrigin, type User } from "@netlify/identity";

// Returns the logged-in admin, or a Response to send back when the request
// isn't allowed. Only Identity users with the `admin` role can manage pages.
export async function requireAdmin(req: Request): Promise<User | Response> {
  if (req.method !== "GET") {
    try {
      verifyRequestOrigin(req);
    } catch {
      return Response.json({ error: "Request origin not allowed." }, { status: 403 });
    }
  }

  const user = await getUser();
  if (!user) {
    return Response.json({ error: "Please log in." }, { status: 401 });
  }
  if (!user.roles?.includes("admin")) {
    return Response.json(
      { error: "Your account doesn't have the admin role yet." },
      { status: 403 },
    );
  }
  return user;
}

// Kicks off a new deploy so dashboard changes show up on the site.
// Requires a build hook URL saved in the COMIC_BUILD_HOOK_URL env var.
export async function triggerRebuild(): Promise<boolean> {
  const hook = process.env.COMIC_BUILD_HOOK_URL;
  if (!hook) return false;
  try {
    const res = await fetch(hook, { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}
