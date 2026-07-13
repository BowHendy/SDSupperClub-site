"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getIdentityAuthHash } from "@/lib/netlify-identity-auth-hash";

/**
 * Netlify Identity invite/recovery links land on the site root with a hash token.
 * Redirect to /login/ so the custom Create Password form can handle the token.
 */
export function NetlifyIdentityBootstrap() {
  const pathname = usePathname();

  useEffect(() => {
    const hash = getIdentityAuthHash();
    const onLoginPage = pathname === "/login" || pathname === "/login/";

    if (!hash || onLoginPage) return;

    window.location.replace(`/login/${hash}`);
  }, [pathname]);

  return null;
}
