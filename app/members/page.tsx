"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UPCOMING_DINNER } from "@/lib/mock-data";

const AUTH_KEY = "sdsc_auth";

export default function MembersPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (typeof window !== "undefined" && !sessionStorage.getItem(AUTH_KEY)) {
      router.replace("/login/");
    }
  }, [mounted, router]);

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_KEY);
    router.replace("/login/");
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <p className="font-geist text-foreground/60">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal px-6 py-16 md:px-8">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-cormorant text-xl text-foreground hover:opacity-90">
            SD Supper Club
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="font-geist text-body-sm text-foreground/70 hover:text-foreground"
          >
            Sign out
          </button>
        </div>

        <h1 className="mt-16 font-cormorant text-display-sm font-medium text-foreground">
          March Dinner
        </h1>
        <p className="mt-2 font-geist text-label uppercase tracking-wider text-brass">
          {UPCOMING_DINNER.month} {UPCOMING_DINNER.year} · {UPCOMING_DINNER.neighborhood}
        </p>

        <div className="mt-10 space-y-8 rounded border border-white/10 bg-charcoal/80 p-8">
          <div>
            <h2 className="font-cormorant text-xl text-foreground">Address</h2>
            <p className="mt-2 font-geist text-body-md text-foreground/90">
              [Address will be shared via email to confirmed guests]
            </p>
          </div>
          <div>
            <h2 className="font-cormorant text-xl text-foreground">When</h2>
            <p className="mt-2 font-geist text-body-md text-foreground/90">
              Saturday, 7:00 PM. Plan for a long evening.
            </p>
          </div>
          <div>
            <h2 className="font-cormorant text-xl text-foreground">What to bring</h2>
            <p className="mt-2 font-geist text-body-md text-foreground/90">
              Yourself, and a bottle of wine if you&apos;d like. We&apos;ll have plenty, but contributions are welcome.
            </p>
          </div>
        </div>

        <p className="mt-12 font-geist text-body-sm text-foreground/70">
          See you at the table.
        </p>
      </div>
    </div>
  );
}
