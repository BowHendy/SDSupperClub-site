"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { initNetlifyIdentity, loadNetlifyIdentity } from "@/lib/netlify-identity";
import { fetchAuthed } from "@/lib/netlify-api";
import { netlifyFunctionUrl } from "@/lib/netlify-paths";

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

type Attendance = {
  id: string;
  status: string;
};

type MemberSummary = {
  meal: Meal | null;
  attendance: Attendance | null;
  confirmedCount: number;
  maxSeats: number | null;
  isFull: boolean;
  isHostApproved: boolean;
  pendingHostRequest: boolean;
};

export default function MembersPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [summary, setSummary] = useState<MemberSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hostMessage, setHostMessage] = useState("");
  const [hostMobilePhone, setHostMobilePhone] = useState("");
  const [hostAddress, setHostAddress] = useState("");
  const [cutlery, setCutlery] = useState(false);
  const [glassware, setGlassware] = useState(false);
  const [crockery, setCrockery] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoadError(null);
    try {
      const ni = await loadNetlifyIdentity();
      await ni.refresh();
      const res = await fetchAuthed(netlifyFunctionUrl("get-member-summary"));
      const json = (await res.json()) as MemberSummary & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? res.statusText);
      }
      setSummary({
        meal: json.meal,
        attendance: json.attendance,
        confirmedCount: json.confirmedCount,
        maxSeats: json.maxSeats,
        isFull: json.isFull,
        isHostApproved: json.isHostApproved,
        pendingHostRequest: json.pendingHostRequest,
      });
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load member data.");
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await initNetlifyIdentity();
        if (cancelled) return;
        const ni = await loadNetlifyIdentity();
        if (cancelled) return;
        if (!ni.currentUser()) {
          router.replace("/login/");
          return;
        }
        await loadSummary();
      } finally {
        if (!cancelled) setMounted(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router, loadSummary]);

  const handleLogout = async () => {
    const ni = await loadNetlifyIdentity();
    await ni.logout();
    router.replace("/login/");
  };

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

  const confirmPaymentStub = async () => {
    if (!summary?.meal?.id) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("confirm-payment"), {
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

  const requestHost = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("request-host"), {
        method: "POST",
        body: JSON.stringify({
          message: hostMessage,
          mobilePhone: hostMobilePhone,
          address: hostAddress,
          cutlery,
          glassware,
          crockery,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Request failed");
      setHostMessage("");
      setHostMobilePhone("");
      setHostAddress("");
      setCutlery(false);
      setGlassware(false);
      setCrockery(false);
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

  return (
    <div className="min-h-screen bg-charcoal px-6 py-16 md:px-8">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-cormorant text-xl text-foreground hover:opacity-90">
            SD Supper Club
          </Link>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="font-geist text-body-sm text-foreground/70 hover:text-foreground"
          >
            Sign out
          </button>
        </div>

        <h1 className="mt-16 font-cormorant text-display-sm font-medium text-foreground">Member home</h1>
        <p className="mt-2 font-geist text-body-sm text-foreground/70">
          Upcoming meal, your seat, and host tools.
        </p>

        {loadError && (
          <p className="mt-8 rounded border border-terracotta/40 bg-terracotta/10 p-4 font-geist text-body-sm text-terracotta">
            {loadError}
            <span className="mt-2 block text-foreground/70">
              Confirm <code className="text-foreground">NETLIFY_DATABASE_URL</code> in Netlify env, apply{" "}
              <code className="text-foreground">netlify/db/schema.sql</code> in Neon (or <code className="text-foreground">npm run db:apply-schema</code>{" "}
              locally with that URL in <code className="text-foreground">.env.local</code>), then redeploy. If the problem started when{" "}
              <strong>accepting an Identity invite</strong>, check Netlify → Functions →{" "}
              <code className="text-foreground">identity-signup</code> logs. Use{" "}
              <code className="text-foreground">npx netlify dev</code> to exercise functions locally.
            </span>
          </p>
        )}

        {actionError && (
          <p className="mt-4 font-geist text-body-sm text-terracotta">{actionError}</p>
        )}

        {summary && (
          <div className="mt-10 space-y-10">
            <section className="rounded border border-white/10 bg-charcoal/80 p-8">
              <h2 className="font-cormorant text-xl text-foreground">Upcoming dinner</h2>
              {!summary.meal ? (
                <p className="mt-4 font-geist text-body-md text-foreground/80">No meal is scheduled yet.</p>
              ) : (
                <>
                  <p className="mt-2 font-geist text-label uppercase tracking-wider text-brass">
                    {summary.meal.month} {summary.meal.year} · {summary.meal.neighborhood}
                  </p>
                  {summary.meal.title && (
                    <p className="mt-1 font-geist text-body-sm text-foreground/80">{summary.meal.title}</p>
                  )}
                  <p className="mt-2 font-cormorant text-lg text-foreground">Chef {summary.meal.chef_name}</p>
                  <p className="mt-4 font-geist text-body-sm text-foreground/70">
                    Seats taken (paid/confirmed): {summary.confirmedCount} / {summary.maxSeats ?? summary.meal.max_seats}
                  </p>
                  {summary.isFull || summary.meal.status === "full" ? (
                    <p className="mt-4 inline-block rounded border border-brass/50 px-3 py-1 font-geist text-label uppercase tracking-wider text-brass">
                      Full
                    </p>
                  ) : summary.meal.status === "live" ? (
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={
                          busy ||
                          Boolean(summary.attendance) ||
                          summary.isFull
                        }
                        onClick={() => void requestAttendance()}
                        className="rounded border border-foreground/60 px-5 py-2.5 font-geist text-body-sm text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Request to attend
                      </button>
                    </div>
                  ) : (
                    <p className="mt-4 font-geist text-body-sm text-foreground/60">
                      This meal isn&apos;t open for requests yet.
                    </p>
                  )}

                  {summary.attendance && (
                    <div className="mt-6 border-t border-white/10 pt-6">
                      <h3 className="font-cormorant text-lg text-foreground">Your status</h3>
                      <p className="mt-2 font-geist text-body-md capitalize text-foreground/90">
                        {summary.attendance.status.replace(/-/g, " ")}
                      </p>
                      {(summary.attendance.status === "waitlisted" ||
                        summary.attendance.status === "invited") && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void confirmPaymentStub()}
                          className="mt-4 rounded border border-brass/60 px-5 py-2.5 font-geist text-body-sm text-brass transition-colors hover:bg-brass hover:text-charcoal disabled:opacity-40"
                        >
                          Pay for your seat (demo)
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="rounded border border-white/10 bg-charcoal/80 p-8">
              <h2 className="font-cormorant text-xl text-foreground">Request to host</h2>
              <p className="mt-2 font-geist text-body-sm text-foreground/70">
                Ask the club admins to approve you as a host. If accepted, you&apos;ll see meal management below.
              </p>
              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block font-geist text-body-sm text-foreground/80">
                    Mobile phone number
                  </label>
                  <input
                    type="tel"
                    value={hostMobilePhone}
                    onChange={(e) => setHostMobilePhone(e.target.value)}
                    disabled={summary.pendingHostRequest || busy}
                    placeholder="(optional)"
                    className="w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 focus:border-brass focus:outline-none disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-geist text-body-sm text-foreground/80">
                    Address (street, city, ZIP)
                  </label>
                  <textarea
                    value={hostAddress}
                    onChange={(e) => setHostAddress(e.target.value)}
                    rows={3}
                    disabled={summary.pendingHostRequest || busy}
                    placeholder="Full address"
                    className="mt-0 w-full resize-none rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 focus:border-brass focus:outline-none disabled:opacity-50"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="inline-flex items-center gap-3 font-geist text-body-sm text-foreground/70">
                    <input
                      type="checkbox"
                      checked={cutlery}
                      onChange={(e) => setCutlery(e.target.checked)}
                      disabled={summary.pendingHostRequest || busy}
                    />
                    Cutlery
                  </label>
                  <label className="inline-flex items-center gap-3 font-geist text-body-sm text-foreground/70">
                    <input
                      type="checkbox"
                      checked={glassware}
                      onChange={(e) => setGlassware(e.target.checked)}
                      disabled={summary.pendingHostRequest || busy}
                    />
                    Glassware
                  </label>
                  <label className="inline-flex items-center gap-3 font-geist text-body-sm text-foreground/70">
                    <input
                      type="checkbox"
                      checked={crockery}
                      onChange={(e) => setCrockery(e.target.checked)}
                      disabled={summary.pendingHostRequest || busy}
                    />
                    Crockery
                  </label>
                </div>
              </div>

              <textarea
                value={hostMessage}
                onChange={(e) => setHostMessage(e.target.value)}
                rows={3}
                disabled={summary.pendingHostRequest || busy}
                placeholder="Optional message"
                className="mt-4 w-full resize-none rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 focus:border-brass focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                disabled={summary.pendingHostRequest || busy || !hostAddress.trim()}
                onClick={() => void requestHost()}
                className="mt-4 rounded border border-foreground/60 px-5 py-2.5 font-geist text-body-sm text-foreground transition-colors hover:border-foreground hover:bg-foreground hover:text-background disabled:cursor-not-allowed disabled:opacity-40"
              >
                {summary.pendingHostRequest ? "Request sent — pending review" : "Send request to host"}
              </button>
            </section>

            {summary.isHostApproved && (
              <section className="rounded border border-white/10 bg-charcoal/80 p-8">
                <h2 className="font-cormorant text-xl text-foreground">Manage a meal</h2>
                <p className="mt-2 font-geist text-body-sm text-foreground/60">
                  Scaffold — host tools will go here (meal details, guest list, chef notes).
                </p>
                <ul className="mt-6 space-y-4 font-geist text-body-sm text-foreground/50">
                  <li>Meal details — coming soon</li>
                  <li>Guest list — coming soon</li>
                  <li>Chef notes — coming soon</li>
                </ul>
              </section>
            )}
          </div>
        )}

        <p className="mt-12 font-geist text-body-sm text-foreground/70">See you at the table.</p>
      </div>
    </div>
  );
}
