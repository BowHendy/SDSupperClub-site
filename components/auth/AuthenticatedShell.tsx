"use client";

import Link from "next/link";
import type { PrimaryRole } from "@/lib/role-routes";

type Props = {
  role: PrimaryRole;
  isAdmin?: boolean;
  children: React.ReactNode;
};

/** Guests share the Member destination; highlight Member for both. */
const NAV: { href: string; label: string; activeFor: PrimaryRole[] }[] = [
  { href: "/member/", label: "Members", activeFor: ["guest", "member"] },
  { href: "/host/", label: "Host", activeFor: ["host"] },
  { href: "/chef/", label: "Chef", activeFor: ["chef"] },
];

export function AuthenticatedShell({ role, isAdmin, children }: Props) {
  return (
    <div className="min-h-screen bg-charcoal px-6 py-16 md:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="font-cormorant text-xl text-foreground hover:opacity-90">
            Supper Collective
          </Link>
          <nav className="flex flex-wrap gap-2">
            {NAV.map(({ href, label, activeFor }) => {
              const active = activeFor.includes(role);
              return (
                <Link
                  key={href}
                  href={href}
                  className={[
                    "rounded border px-3 py-1.5 font-geist text-body-sm transition-colors",
                    active
                      ? "border-brass/60 bg-brass/10 text-brass"
                      : "border-white/15 text-foreground/60 hover:text-foreground",
                  ].join(" ")}
                >
                  {label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                href="/admin/"
                className="rounded border border-brass/40 px-3 py-1.5 font-geist text-body-sm text-brass hover:bg-brass/10"
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
        {children}
      </div>
    </div>
  );
}
