import { fetchAuthed, netlifyFunctionUrl } from "@/lib/netlify-api";
import { homeForRole, type PrimaryRole } from "@/lib/role-routes";

/**
 * After a successful Identity login, send the user to their dashboard.
 * Admins land on /admin/; everyone else uses primary_role home
 * (guests share the member page at /member/).
 */
export async function redirectAfterLogin(router: { replace: (path: string) => void }): Promise<void> {
  try {
    const adminRes = await fetchAuthed(netlifyFunctionUrl("admin-me"));
    const adminJson = (await adminRes.json()) as { isAdmin?: boolean };
    if (adminJson.isAdmin) {
      router.replace("/admin/");
      return;
    }
  } catch {
    /* not admin or admin-me unavailable */
  }

  try {
    const res = await fetchAuthed(netlifyFunctionUrl("get-member-summary"));
    const json = (await res.json()) as { primaryRole?: PrimaryRole };
    router.replace(homeForRole(json.primaryRole ?? "guest"));
  } catch {
    router.replace("/member/");
  }
}
