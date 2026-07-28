"use client";

import { useState } from "react";
import Link from "next/link";
import { login, requestPasswordRecovery } from "@netlify/identity";
import { formatAuthError } from "@/lib/auth-errors";

const FIELD_CLASS =
  "w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 focus:border-brass focus:outline-none";

type LoginFormProps = {
  onSuccess: () => void;
};

export function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoverySent, setRecoverySent] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);

  const canSubmit =
    email.trim().length > 0 && password.length > 0 && !busy && !recoveryBusy;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Email and password are required.");
      return;
    }

    setBusy(true);
    try {
      await login(trimmedEmail, password);
      onSuccess();
    } catch (e) {
      setError(formatAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your email above, then click Forgot password.");
      return;
    }

    setRecoveryBusy(true);
    try {
      await requestPasswordRecovery(trimmedEmail);
    } catch {
      /* Always show the same message to avoid account enumeration. */
    } finally {
      setRecoverySent(true);
      setRecoveryBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-4">
      <div>
        <label htmlFor="login-email" className="mb-1 block font-geist text-body-sm text-foreground/80">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          className={FIELD_CLASS}
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="login-password" className="mb-1 block font-geist text-body-sm text-foreground/80">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          className={FIELD_CLASS}
          placeholder="Password"
        />
      </div>

      {error && (
        <p className="font-geist text-body-sm text-terracotta" role="alert">
          {error}
        </p>
      )}

      {recoverySent && (
        <p className="font-geist text-body-sm text-foreground/85" role="status">
          If an account exists for that email, we&apos;ve sent a password reset link.
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded border border-foreground/60 py-3 font-geist text-body-sm text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Signing in…" : "Log in"}
      </button>

      <p className="text-center">
        <button
          type="button"
          onClick={() => void handleForgotPassword()}
          disabled={busy || recoveryBusy}
          className="font-geist text-body-sm text-foreground/70 underline underline-offset-2 hover:text-foreground disabled:opacity-50"
        >
          {recoveryBusy ? "Sending…" : "Forgot password?"}
        </button>
      </p>

      <p className="text-center font-geist text-body-sm text-foreground/60">
        No account yet?{" "}
        <Link href="/#request-invite" className="text-brass underline">
          Request to join
        </Link>
      </p>
    </form>
  );
}
