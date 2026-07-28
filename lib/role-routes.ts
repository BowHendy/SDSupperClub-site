export type PrimaryRole = "guest" | "member" | "host" | "chef";

/** Guests share the members page; member features unlock after first attended meal. */
export const ROLE_HOME: Record<PrimaryRole, string> = {
  guest: "/member/",
  member: "/member/",
  host: "/host/",
  chef: "/chef/",
};

export function homeForRole(role: PrimaryRole): string {
  return ROLE_HOME[role] ?? "/member/";
}
