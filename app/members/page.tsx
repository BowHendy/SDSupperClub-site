"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { initNetlifyIdentity, loadNetlifyIdentity } from "@/lib/netlify-identity";
import { fetchAuthed, netlifyFunctionUrl } from "@/lib/netlify-api";
import { homeForRole, type PrimaryRole } from "@/lib/role-routes";

/** Legacy /members/ → role-aware home. Handles Stripe checkout return via ?paid=1&session_id=… */
export default function MembersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initNetlifyIdentity();
      const ni = await loadNetlifyIdentity();
      if (!ni.currentUser()) {
        router.replace("/login/");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const paid = params.get("paid");
      const sessionId = params.get("session_id");

      try {
        const res = await fetchAuthed(netlifyFunctionUrl("get-member-summary"));
        const json = (await res.json()) as { primaryRole?: PrimaryRole; meal?: { id: string } | null };
        if (cancelled) return;

        if (paid === "1" && sessionId && json.meal?.id) {
          try {
            await fetchAuthed(netlifyFunctionUrl("confirm-payment"), {
              method: "POST",
              body: JSON.stringify({ mealId: json.meal.id, sessionId }),
            });
          } catch {
            // Webhook may have already fulfilled; redirect either way.
          }
        }

        router.replace(homeForRole(json.primaryRole ?? "guest"));
      } catch {
        if (!cancelled) router.replace("/guest/");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal">
      <p className="font-geist text-foreground/60">Redirecting…</p>
    </div>
  );
}
