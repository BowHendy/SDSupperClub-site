"use client";

import type { PasswordFlowType } from "@/lib/netlify-identity-auth-hash";

type Props = {
  flow: PasswordFlowType;
  onContinue: () => void;
};

export function PasswordSuccessModal({ flow, onContinue }: Props) {
  const title = flow === "invite" ? "Password created" : "Password updated";
  const body =
    flow === "invite"
      ? "Your password is set. You’ve been signed out for security — please sign in with your new password to continue."
      : "Your password has been updated. You’ve been signed out for security — please sign in with your new password to continue.";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="password-success-title"
    >
      <div className="w-full max-w-md rounded border border-white/15 bg-charcoal p-8 shadow-lg">
        <h2 id="password-success-title" className="font-cormorant text-2xl text-foreground">
          {title}
        </h2>
        <p className="mt-4 font-geist text-body-md text-foreground/80">{body}</p>
        <button
          type="button"
          onClick={onContinue}
          className="mt-8 w-full rounded border border-foreground/60 bg-foreground py-3 font-geist text-body-sm text-background transition-colors hover:opacity-90"
        >
          Continue to sign in
        </button>
      </div>
    </div>
  );
}
