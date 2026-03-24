"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "/#experience", label: "Experience" },
  { href: "/#past-menus", label: "Past Menus" },
  { href: "/#how-to-join", label: "How to Join" },
  { href: "/#calendar", label: "Calendar" },
];

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
          SD Supper Club
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

        <Link
          href="/#request-invite"
          className="rounded border border-foreground/60 px-4 py-2 text-body-sm text-foreground transition-all duration-300 hover:border-foreground hover:bg-foreground hover:text-background"
        >
          Request Invite
        </Link>
      </nav>
    </header>
  );
}
