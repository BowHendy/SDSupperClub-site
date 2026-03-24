"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const AUTH_KEY = "sdsc_auth";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (typeof window !== "undefined" && sessionStorage.getItem(AUTH_KEY)) {
      router.replace("/members/");
    }
  }, [mounted, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const expected = process.env.NEXT_PUBLIC_MEMBERS_PASSWORD ?? "";
    if (!expected) {
      setError("Members area is not configured.");
      return;
    }
    if (password === expected) {
      sessionStorage.setItem(AUTH_KEY, "1");
      router.replace("/members/");
    } else {
      setError("Incorrect password.");
    }
  };

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
        <h1 className="font-cormorant text-display-sm font-medium text-foreground">
          Members
        </h1>
        <p className="mt-2 font-geist text-body-sm text-foreground/70">
          Enter the password from your invitation.
        </p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 focus:border-brass focus:outline-none"
            autoFocus
          />
          {error && (
            <p className="text-body-sm text-terracotta">{error}</p>
          )}
          <button
            type="submit"
            className="w-full rounded border border-foreground/60 py-3 font-geist text-body-sm text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
          >
            Enter
          </button>
        </form>
        <p className="mt-8 text-center">
          <Link href="/" className="font-geist text-body-sm text-foreground/70 hover:text-foreground">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
