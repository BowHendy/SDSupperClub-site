export type PrimaryRole = "guest" | "member" | "host" | "chef";

export const ROLE_HOME: Record<PrimaryRole, string> = {
  guest: "/guest/",
  member: "/member/",
  host: "/host/",
  chef: "/chef/",
};

export function homeForRole(role: PrimaryRole): string {
  return ROLE_HOME[role] ?? "/guest/";
}
