"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isSignedIn, subscribeAuthChange } from "@/lib/auth-session";

const NAV_LINKS = [
  { href: "/#experience", label: "Experience" },
  { href: "/#past-menus", label: "Past Menus" },
  { href: "/#how-to-join", label: "How to Join" },
  { href: "/#calendar", label: "Calendar" },
];

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await isSignedIn();
      if (!cancelled) {
        setSignedIn(ok);
        setAuthChecked(true);
      }
    })();
    const unsub = subscribeAuthChange((ok) => setSignedIn(ok));
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-charcoal/90 backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-8">
        <Link
          href="/"
          className="font-cormorant text-xl font-medium text-foreground transition-opacity hover:opacity-90 md:text-2xl"
        >
          Supper Collective
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <li key={label}>
              <Link
                href={href}
                className="text-body-sm text-foreground/90 transition-colors hover:text-foreground"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <Link
            href="/#request-invite"
            className="rounded border border-foreground/60 px-4 py-2 text-body-sm text-foreground transition-all duration-300 hover:border-foreground hover:bg-foreground hover:text-background"
          >
            Request to join
          </Link>
          {authChecked &&
            (signedIn ? (
              <Link
                href="/members/"
                className="rounded border border-transparent px-4 py-2 text-body-sm text-foreground/90 transition-colors hover:text-foreground"
              >
                My account
              </Link>
            ) : (
              <Link
                href="/login/"
                className="rounded border border-foreground/60 px-4 py-2 text-body-sm text-foreground transition-all duration-300 hover:border-foreground hover:bg-foreground hover:text-background"
              >
                Sign in
              </Link>
            ))}
        </div>
      </nav>
    </header>
  );
}
