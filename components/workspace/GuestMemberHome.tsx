"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { initNetlifyIdentity, loadNetlifyIdentity } from "@/lib/netlify-identity";
import { fetchAuthed, netlifyFunctionUrl } from "@/lib/netlify-api";
import { AuthenticatedShell } from "@/components/auth/AuthenticatedShell";
import { RoleApplicationForms } from "@/components/workspace/RoleApplicationForms";
import type { PrimaryRole } from "@/lib/role-routes";

type Meal = {
  id: string;
  title: string | null;
  month: string;
  year: number;
  neighborhood: string;
  chef_name: string;
  status: string;
  max_seats: number;
};

type Attendance = { id: string; status: string };

type Summary = {
  meal: Meal | null;
  attendance: Attendance | null;
  confirmedCount: number;
  maxSeats: number | null;
  isFull: boolean;
  primaryRole: PrimaryRole;
  profileComplete: boolean;
  isHostApproved: boolean;
  pendingHostRequest: boolean;
  isChefApproved: boolean;
  pendingChefRequest: boolean;
  isAdmin?: boolean;
};

const ROLE_LABEL: Record<PrimaryRole, string> = {
  guest: "Guest home",
  member: "Member home",
  host: "Host workspace",
  chef: "Chef workspace",
};

type Props = { expectedRole?: "guest" | "member" };

export function GuestMemberHome({ expectedRole }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState({
    firstName: "",
    surname: "",
    mobilePhone: "",
    zip: "",
    allergies: "",
  });

  const loadSummary = useCallback(async () => {
    setLoadError(null);
    const res = await fetchAuthed(netlifyFunctionUrl("get-member-summary"));
    const json = (await res.json()) as Summary & { error?: string };
    if (!res.ok) throw new Error(json.error ?? res.statusText);
    setSummary(json);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await initNetlifyIdentity();
      const ni = await loadNetlifyIdentity();
      if (!ni.currentUser()) {
        router.replace("/login/");
        return;
      }
      try {
        await loadSummary();
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Could not load data.");
      } finally {
        if (!cancelled) setMounted(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, loadSummary]);

  const requestAttendance = async () => {
    if (!summary?.meal?.id) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("request-attendance"), {
        method: "POST",
        body: JSON.stringify({ mealId: summary.meal.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      await loadSummary();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    if (!summary?.meal?.id) return;
    setBusy(true);
    setActionError(null);
    try {
      const checkoutRes = await fetchAuthed(netlifyFunctionUrl("create-checkout"), {
        method: "POST",
        body: JSON.stringify({ mealId: summary.meal.id }),
      });
      const checkoutJson = await checkoutRes.json();
      if (checkoutRes.ok && checkoutJson.url) {
        window.location.href = checkoutJson.url as string;
        return;
      }
      const res = await fetchAuthed(netlifyFunctionUrl("confirm-payment"), {
        method: "POST",
        body: JSON.stringify({ mealId: summary.meal.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Payment failed");
      await loadSummary();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("save-member-profile"), {
        method: "POST",
        body: JSON.stringify(profile),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      await loadSummary();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <p className="font-geist text-foreground/60">Loading…</p>
      </div>
    );
  }

  const role = summary?.primaryRole ?? "guest";

  return (
    <AuthenticatedShell role={role} isAdmin={summary?.isAdmin}>
      <div className="mt-16 flex items-center justify-between">
        <div>
          <h1 className="font-cormorant text-display-sm font-medium text-foreground">
            {ROLE_LABEL[expectedRole ?? role]}
          </h1>
          {role === "member" && (
            <p className="mt-1 font-geist text-label uppercase tracking-wider text-brass">Verified Member</p>
          )}
        </div>
        <button
          type="button"
          onClick={async () => {
            const ni = await loadNetlifyIdentity();
            await ni.logout();
            router.replace("/login/");
          }}
          className="font-geist text-body-sm text-foreground/70 hover:text-foreground"
        >
          Sign out
        </button>
      </div>

      {loadError && (
        <p className="mt-8 rounded border border-terracotta/40 bg-terracotta/10 p-4 font-geist text-body-sm text-terracotta">
          {loadError}
        </p>
      )}
      {actionError && <p className="mt-4 font-geist text-body-sm text-terracotta">{actionError}</p>}

      {summary && (
        <div className="mt-10 space-y-10">
          {summary.attendance?.status === "approved" && !summary.profileComplete && (
            <section className="rounded border border-white/10 bg-charcoal/80 p-8">
              <h2 className="font-cormorant text-xl text-foreground">Complete your profile</h2>
              <div className="mt-4 grid gap-3">
                {(["firstName", "surname", "mobilePhone", "zip", "allergies"] as const).map((k) => (
                  <input
                    key={k}
                    placeholder={k}
                    value={profile[k]}
                    onChange={(e) => setProfile((p) => ({ ...p, [k]: e.target.value }))}
                    className="rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground"
                  />
                ))}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveProfile()}
                  className="rounded border border-brass/60 px-5 py-2.5 font-geist text-body-sm text-brass"
                >
                  Save profile
                </button>
              </div>
            </section>
          )}

          <section className="rounded border border-white/10 bg-charcoal/80 p-8">
            <h2 className="font-cormorant text-xl text-foreground">Upcoming dinner</h2>
            {!summary.meal ? (
              <p className="mt-4 font-geist text-body-md text-foreground/80">No live meal right now.</p>
            ) : (
              <>
                <p className="mt-2 font-geist text-label uppercase tracking-wider text-brass">
                  {summary.meal.month} {summary.meal.year} · {summary.meal.neighborhood}
                </p>
                <p className="mt-2 font-cormorant text-lg text-foreground">Chef {summary.meal.chef_name}</p>
                {!summary.attendance && summary.meal.status === "live" && !summary.isFull && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void requestAttendance()}
                    className="mt-6 rounded border border-foreground/60 px-5 py-2.5 font-geist text-body-sm text-foreground"
                  >
                    Request to attend
                  </button>
                )}
                {summary.attendance && (
                  <div className="mt-6 border-t border-white/10 pt-6">
                    <p className="font-geist capitalize text-foreground/90">{summary.attendance.status}</p>
                    {(summary.attendance.status === "approved" ||
                      summary.attendance.status === "invited") &&
                      summary.profileComplete && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void pay()}
                          className="mt-4 rounded border border-brass/60 px-5 py-2.5 font-geist text-body-sm text-brass"
                        >
                          Pay for your seat
                        </button>
                      )}
                  </div>
                )}
              </>
            )}
          </section>

          <RoleApplicationForms
            isHostApproved={summary.isHostApproved}
            isChefApproved={summary.isChefApproved}
            pendingHostRequest={summary.pendingHostRequest}
            pendingChefRequest={summary.pendingChefRequest}
            busy={busy}
            setBusy={setBusy}
            onSubmitted={loadSummary}
            onError={(msg) => setActionError(msg || null)}
          />

          {(summary.isHostApproved || summary.isChefApproved) && (
            <p className="font-geist text-body-sm text-foreground/60">
              {summary.isHostApproved && (
                <>
                  You&apos;re an approved host — open your{" "}
                  <Link href="/host/" className="text-brass underline">
                    host workspace
                  </Link>
                  .
                </>
              )}
              {summary.isHostApproved && summary.isChefApproved && " "}
              {summary.isChefApproved && (
                <>
                  You&apos;re an approved chef — open your{" "}
                  <Link href="/chef/" className="text-brass underline">
                    chef workspace
                  </Link>
                  .
                </>
              )}
            </p>
          )}
        </div>
      )}
    </AuthenticatedShell>
  );
}
