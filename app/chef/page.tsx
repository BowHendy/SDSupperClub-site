"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initNetlifyIdentity, loadNetlifyIdentity } from "@/lib/netlify-identity";
import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { ChefWorkspace } from "@/components/workspace/ChefWorkspace";

export default function ChefPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      await initNetlifyIdentity();
      const ni = await loadNetlifyIdentity();
      if (!ni.currentUser()) router.replace("/login/");
      else setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <p className="font-geist text-foreground/60">Loading…</p>
      </div>
    );
  }

  return (
    <AuthenticatedShell role="chef">
      <h1 className="mt-16 font-cormorant text-display-sm font-medium text-foreground">Chef workspace</h1>
      <ChefWorkspace />
    </AuthenticatedShell>
  );
}
