"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Guests and members share /member/; keep /guest/ as a redirect. */
export default function GuestPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/member/");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal">
      <p className="font-geist text-foreground/60">Redirecting…</p>
    </div>
  );
}
