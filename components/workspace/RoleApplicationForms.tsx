"use client";

import { useState } from "react";
import { fetchAuthed, netlifyFunctionUrl } from "@/lib/netlify-api";

type Props = {
  isHostApproved: boolean;
  isChefApproved: boolean;
  pendingHostRequest: boolean;
  pendingChefRequest: boolean;
  busy: boolean;
  onSubmitted: () => Promise<void>;
  onError: (message: string) => void;
  setBusy: (v: boolean) => void;
};

export function RoleApplicationForms({
  isHostApproved,
  isChefApproved,
  pendingHostRequest,
  pendingChefRequest,
  busy,
  onSubmitted,
  onError,
  setBusy,
}: Props) {
  const [hostForm, setHostForm] = useState({
    message: "",
    mobilePhone: "",
    address: "",
    allergies: "",
    kitchenPhotoUrl: "",
    diningPhotoUrl: "",
    cutlery: false,
    glassware: false,
    crockery: false,
  });

  const [chefForm, setChefForm] = useState({
    bio: "",
    cvUrl: "",
    references: "",
    headshotUrl: "",
    mobilePhone: "",
    foodGenres: "",
  });

  const submitHost = async () => {
    setBusy(true);
    onError("");
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("request-host"), {
        method: "POST",
        body: JSON.stringify(hostForm),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      setHostForm({
        message: "",
        mobilePhone: "",
        address: "",
        allergies: "",
        kitchenPhotoUrl: "",
        diningPhotoUrl: "",
        cutlery: false,
        glassware: false,
        crockery: false,
      });
      await onSubmitted();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const submitChef = async () => {
    setBusy(true);
    onError("");
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("chef-apply"), {
        method: "POST",
        body: JSON.stringify({
          ...chefForm,
          foodGenres: chefForm.foodGenres
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      setChefForm({ bio: "", cvUrl: "", references: "", headshotUrl: "", mobilePhone: "", foodGenres: "" });
      await onSubmitted();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-10">
      {!isHostApproved && (
        <section className="rounded border border-white/10 bg-charcoal/80 p-8">
          <h2 className="font-cormorant text-xl text-foreground">Apply to host</h2>
          <p className="mt-2 font-geist text-body-sm text-foreground/70">
            Complete your profile and equipment checklist before submitting. Admins review every application.
          </p>
          <div className="mt-6 space-y-4">
            <input
              type="tel"
              value={hostForm.mobilePhone}
              onChange={(e) => setHostForm((f) => ({ ...f, mobilePhone: e.target.value }))}
              disabled={pendingHostRequest || busy}
              placeholder="Mobile phone"
              className="w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 disabled:opacity-50"
            />
            <textarea
              value={hostForm.address}
              onChange={(e) => setHostForm((f) => ({ ...f, address: e.target.value }))}
              rows={3}
              disabled={pendingHostRequest || busy}
              placeholder="Full address (street, city, ZIP)"
              className="w-full resize-none rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 disabled:opacity-50"
            />
            <input
              value={hostForm.allergies}
              onChange={(e) => setHostForm((f) => ({ ...f, allergies: e.target.value }))}
              disabled={pendingHostRequest || busy}
              placeholder="Allergies (optional)"
              className="w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 disabled:opacity-50"
            />
            <input
              value={hostForm.kitchenPhotoUrl}
              onChange={(e) => setHostForm((f) => ({ ...f, kitchenPhotoUrl: e.target.value }))}
              disabled={pendingHostRequest || busy}
              placeholder="Kitchen photo URL"
              className="w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 disabled:opacity-50"
            />
            <input
              value={hostForm.diningPhotoUrl}
              onChange={(e) => setHostForm((f) => ({ ...f, diningPhotoUrl: e.target.value }))}
              disabled={pendingHostRequest || busy}
              placeholder="Dining room photo URL"
              className="w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 disabled:opacity-50"
            />
            <div className="flex flex-col gap-2">
              {(["cutlery", "glassware", "crockery"] as const).map((key) => (
                <label key={key} className="inline-flex items-center gap-3 font-geist text-body-sm text-foreground/70">
                  <input
                    type="checkbox"
                    checked={hostForm[key]}
                    onChange={(e) => setHostForm((f) => ({ ...f, [key]: e.target.checked }))}
                    disabled={pendingHostRequest || busy}
                  />
                  {key.charAt(0).toUpperCase() + key.slice(1)} for 10 guests
                </label>
              ))}
            </div>
            <textarea
              value={hostForm.message}
              onChange={(e) => setHostForm((f) => ({ ...f, message: e.target.value }))}
              rows={2}
              disabled={pendingHostRequest || busy}
              placeholder="Optional message to admins"
              className="w-full resize-none rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 disabled:opacity-50"
            />
            <button
              type="button"
              disabled={pendingHostRequest || busy}
              onClick={() => void submitHost()}
              className="rounded border border-foreground/60 px-5 py-2.5 font-geist text-body-sm text-foreground transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pendingHostRequest ? "Host application pending review" : "Submit host application"}
            </button>
          </div>
        </section>
      )}

      {!isChefApproved && (
        <section className="rounded border border-white/10 bg-charcoal/80 p-8">
          <h2 className="font-cormorant text-xl text-foreground">Apply to cook</h2>
          <p className="mt-2 font-geist text-body-sm text-foreground/70">
            CV and professional references are required. You may apply without attending a dinner first.
          </p>
          <div className="mt-6 space-y-4">
            <input
              value={chefForm.mobilePhone}
              onChange={(e) => setChefForm((f) => ({ ...f, mobilePhone: e.target.value }))}
              disabled={pendingChefRequest || busy}
              placeholder="Mobile phone (optional)"
              className="w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 disabled:opacity-50"
            />
            <input
              value={chefForm.foodGenres}
              onChange={(e) => setChefForm((f) => ({ ...f, foodGenres: e.target.value }))}
              disabled={pendingChefRequest || busy}
              placeholder="Food genres (comma-separated)"
              className="w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 disabled:opacity-50"
            />
            <textarea
              value={chefForm.bio}
              onChange={(e) => setChefForm((f) => ({ ...f, bio: e.target.value }))}
              rows={3}
              disabled={pendingChefRequest || busy}
              placeholder="Short bio"
              className="w-full resize-none rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 disabled:opacity-50"
            />
            <input
              value={chefForm.cvUrl}
              onChange={(e) => setChefForm((f) => ({ ...f, cvUrl: e.target.value }))}
              disabled={pendingChefRequest || busy}
              placeholder="CV URL (required)"
              className="w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 disabled:opacity-50"
            />
            <input
              value={chefForm.headshotUrl}
              onChange={(e) => setChefForm((f) => ({ ...f, headshotUrl: e.target.value }))}
              disabled={pendingChefRequest || busy}
              placeholder="Headshot URL (optional)"
              className="w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 disabled:opacity-50"
            />
            <textarea
              value={chefForm.references}
              onChange={(e) => setChefForm((f) => ({ ...f, references: e.target.value }))}
              rows={4}
              disabled={pendingChefRequest || busy}
              placeholder="Past references (required)"
              className="w-full resize-none rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 disabled:opacity-50"
            />
            <button
              type="button"
              disabled={pendingChefRequest || busy || !chefForm.cvUrl.trim() || !chefForm.references.trim()}
              onClick={() => void submitChef()}
              className="rounded border border-foreground/60 px-5 py-2.5 font-geist text-body-sm text-foreground transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pendingChefRequest ? "Chef application pending review" : "Submit chef application"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
