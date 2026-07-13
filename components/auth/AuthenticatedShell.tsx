"use client";

import Link from "next/link";
import type { PrimaryRole } from "@/lib/role-routes";
import { ROLE_HOME } from "@/lib/role-routes";

type Props = {
  role: PrimaryRole;
  isAdmin?: boolean;
  children: React.ReactNode;
};

const NAV: { role: PrimaryRole; label: string }[] = [
  { role: "guest", label: "Guest" },
  { role: "member", label: "Member" },
  { role: "host", label: "Host" },
  { role: "chef", label: "Chef" },
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
            {NAV.map(({ role: r, label }) => (
              <Link
                key={r}
                href={ROLE_HOME[r]}
                className={[
                  "rounded border px-3 py-1.5 font-geist text-body-sm transition-colors",
                  role === r
                    ? "border-brass/60 bg-brass/10 text-brass"
                    : "border-white/15 text-foreground/60 hover:text-foreground",
                ].join(" ")}
              >
                {label}
              </Link>
            ))}
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
