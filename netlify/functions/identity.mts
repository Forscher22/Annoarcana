import type { User, UserLoginEvent, UserSignupEvent, UserValidateEvent } from "@netlify/functions";

// Email addresses that are allowed an account and get the `admin` role,
// which lets them post pages from the /admin/ dashboard.
const ADMIN_EMAILS = ["forscher22@gmail.com"];

const isAdminEmail = (user: User) => ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "");

function withAdminRole(user: User): User {
  const roles = (user.appMetadata?.roles as string[] | undefined) ?? [];
  if (roles.includes("admin")) return user;
  return {
    ...user,
    appMetadata: { ...user.appMetadata, roles: [...roles, "admin"] },
  };
}

export default {
  // Only listed emails can create an account, so signups can stay open.
  userValidate(event: UserValidateEvent) {
    if (!isAdminEmail(event.user)) return event.deny();
  },

  userSignup(event: UserSignupEvent) {
    if (isAdminEmail(event.user)) return { user: withAdminRole(event.user) };
  },

  // Also covers accounts created before this function existed (e.g. by invite).
  userLogin(event: UserLoginEvent) {
    if (isAdminEmail(event.user)) return { user: withAdminRole(event.user) };
  },
};
