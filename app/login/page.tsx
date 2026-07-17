"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getUser } from "@netlify/identity";
import { CreatePasswordForm } from "@/components/auth/CreatePasswordForm";
import { LoginForm } from "@/components/auth/LoginForm";
import {
  clearIdentityAuthHash,
  getAuthTokenFromHash,
  getPasswordFlowFromHash,
} from "@/lib/netlify-identity-auth-hash";
import { fetchAuthed } from "@/lib/netlify-api";
import { netlifyFunctionUrl } from "@/lib/netlify-paths";

async function redirectAfterLogin(router: { replace: (path: string) => void }) {
  try {
    const res = await fetchAuthed(netlifyFunctionUrl("admin-me"));
    const json = (await res.json()) as { isAdmin?: boolean };
    router.replace(json.isAdmin ? "/admin/" : "/members/");
  } catch {
    router.replace("/members/");
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [passwordFlow, setPasswordFlow] = useState<ReturnType<typeof getPasswordFlowFromHash>>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const flow = getPasswordFlowFromHash();
        const token = flow ? getAuthTokenFromHash(flow) : null;
        if (!cancelled) {
          setPasswordFlow(flow);
          setAuthToken(token);
        }

        if (!flow) {
          const user = await getUser();
          if (!cancelled && user) {
            await redirectAfterLogin(router);
            return;
          }
        }
      } catch {
        /* show login form */
      } finally {
        if (!cancelled) setMounted(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleCancelPassword = () => {
    clearIdentityAuthHash();
    setPasswordFlow(null);
    setAuthToken(null);
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <p className="font-geist text-foreground/60">Loading…</p>
      </div>
    );
  }

  if (passwordFlow && authToken) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-charcoal px-6 py-16">
        <CreatePasswordForm
          flow={passwordFlow}
          token={authToken}
          onSuccess={() => void redirectAfterLogin(router)}
          onCancel={handleCancelPassword}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-charcoal px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="font-cormorant text-display-sm font-medium text-foreground">Members</h1>
        <p className="mt-2 font-geist text-body-sm text-foreground/70">
          Sign in with the email you were invited with. If you don&apos;t have an account yet, accept
          your invite email first — you&apos;ll set your password on this page.
        </p>

        <LoginForm onSuccess={() => void redirectAfterLogin(router)} />

        <p className="mt-8 text-center">
          <Link href="/" className="font-geist text-body-sm text-foreground/70 hover:text-foreground">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
