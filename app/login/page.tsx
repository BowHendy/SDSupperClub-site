"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { initNetlifyIdentity, loadNetlifyIdentity } from "@/lib/netlify-identity";

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [identityReady, setIdentityReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let offLogin: (() => void) | undefined;

    (async () => {
      try {
        await initNetlifyIdentity();
        if (cancelled) return;
        const ni = await loadNetlifyIdentity();
        if (cancelled) return;
        if (ni.currentUser()) {
          router.replace("/members/");
          return;
        }
        const onLogin = () => {
          router.replace("/members/");
        };
        ni.on("login", onLogin);
        offLogin = () => ni.off("login", onLogin);
        setIdentityReady(true);
      } catch {
        // Still show page; user can retry opening the widget
        setIdentityReady(true);
      } finally {
        if (!cancelled) setMounted(true);
      }
    })();

    return () => {
      cancelled = true;
      offLogin?.();
    };
  }, [router]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <p className="font-geist text-foreground/60">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-charcoal px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-cormorant text-display-sm font-medium text-foreground">Members</h1>
        <p className="mt-2 font-geist text-body-sm text-foreground/70">
          Sign in with the email you were invited with. If you don&apos;t have an account yet, accept your invite email
          from Netlify Identity first, then log in here.
        </p>
        <button
          type="button"
          disabled={!identityReady}
          onClick={async () => {
            const ni = await loadNetlifyIdentity();
            ni.open("login");
          }}
          className="mt-8 w-full rounded border border-foreground/60 py-3 font-geist text-body-sm text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-40"
        >
          Log in
        </button>
        <p className="mt-8 text-center">
          <Link href="/" className="font-geist text-body-sm text-foreground/70 hover:text-foreground">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
