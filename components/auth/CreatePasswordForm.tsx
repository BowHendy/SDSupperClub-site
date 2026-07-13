"use client";

import { useMemo, useState } from "react";
import { acceptInvite, recoverPassword } from "@netlify/identity";
import type { PasswordFlowType } from "@/lib/netlify-identity-auth-hash";
import {
  allPasswordRequirementsMet,
  getPasswordRequirementState,
  PASSPHRASE_TIP,
} from "@/lib/password-requirements";
import { initNetlifyIdentity, loadNetlifyIdentity } from "@/lib/netlify-identity";

const FIELD_CLASS =
  "w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 focus:border-brass focus:outline-none";

type CreatePasswordFormProps = {
  flow: PasswordFlowType;
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
};

async function completePasswordFlow(flow: PasswordFlowType, token: string, password: string): Promise<void> {
  if (flow === "invite") {
    await acceptInvite(token, password);
  } else {
    await recoverPassword(token, password);
  }

  await initNetlifyIdentity();
  const ni = await loadNetlifyIdentity();
  if (typeof ni.refresh === "function") {
    await ni.refresh();
  }
}

export function CreatePasswordForm({ flow, token, onSuccess, onCancel }: CreatePasswordFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requirements = useMemo(() => getPasswordRequirementState(password), [password]);
  const allMet = allPasswordRequirementsMet(password);
  const passwordsMatch = password === confirmPassword;
  const showMismatch = confirmTouched && confirmPassword.length > 0 && !passwordsMatch;
  const canSubmit = allMet && passwordsMatch && confirmPassword.length > 0 && !busy;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setConfirmTouched(true);
    setError(null);

    if (!canSubmit) return;

    setBusy(true);
    try {
      await completePasswordFlow(flow, token, password);
      onSuccess();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not create password. Please try again.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="w-full max-w-md">
      <h1 className="text-center font-cormorant text-display-sm font-medium text-foreground">Create Password</h1>

      <ul className="mt-8 space-y-3 font-geist text-body-sm text-foreground/85">
        {requirements.map((req) => (
          <li key={req.id} className="flex items-start gap-3">
            <span
              className={req.met ? "mt-0.5 text-green-500" : "mt-0.5 text-foreground/50"}
              aria-hidden="true"
            >
              {req.met ? "✓" : "•"}
            </span>
            <span className={req.met ? "text-foreground/90" : undefined}>{req.label}</span>
          </li>
        ))}
        <li className="flex items-start gap-3">
          <span className="mt-0.5 text-foreground/50" aria-hidden="true">
            •
          </span>
          <span>{PASSPHRASE_TIP}</span>
        </li>
      </ul>

      <div className="mt-8 space-y-4">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="new-password"
          disabled={busy}
          className={FIELD_CLASS}
        />
        <div>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => setConfirmTouched(true)}
            placeholder="Reenter password"
            autoComplete="new-password"
            disabled={busy}
            className={FIELD_CLASS}
          />
          {showMismatch && (
            <p className="mt-2 font-geist text-body-sm text-terracotta">passwords do not match</p>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 font-geist text-body-sm text-terracotta">{error}</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-8 w-full rounded border border-foreground/60 bg-foreground py-3 font-geist text-body-sm text-background transition-colors hover:border-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Creating…" : "Create password"}
      </button>

      <p className="mt-6 text-center">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="font-geist text-body-sm text-foreground/70 underline underline-offset-2 hover:text-foreground disabled:opacity-50"
        >
          Cancel
        </button>
      </p>
    </form>
  );
}
