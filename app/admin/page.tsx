"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getUser } from "@netlify/identity";
import { signOut, subscribeAuthChange } from "@/lib/auth-session";
import { fetchAuthed } from "@/lib/netlify-api";
import { netlifyFunctionUrl } from "@/lib/netlify-paths";

type InvitationRequest = {
  id: string;
  name: string | null;
  email: string;
  referred_by: string | null;
  why_you_love_to_come: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
};

type HostApplication = {
  id: string;
  member_id: string;
  first_name: string | null;
  surname: string | null;
  email: string | null;
  mobile_phone: string | null;
  address: string;
  allergies: string | null;
  kitchen_photo_url: string | null;
  dining_photo_url: string | null;
  cutlery: boolean;
  glassware: boolean;
  crockery: boolean;
  approval_status: string;
  approval_note: string | null;
  created_at: string;
};

type ChefApplication = {
  id: string;
  member_id: string;
  first_name: string | null;
  surname: string | null;
  email: string | null;
  mobile_phone: string | null;
  bio: string | null;
  headshot_url: string | null;
  cv_url: string | null;
  references_text: string | null;
  food_genres: string[];
  approval_status: string;
  approval_note: string | null;
  created_at: string;
};

type Tab = "invitations" | "applications" | "meals" | "funds" | "disputes";
type StatusFilter = "pending" | "approved" | "rejected" | "all";

const ADMIN_TABS: { id: Tab; label: string }[] = [
  { id: "invitations", label: "New Guests" },
  { id: "applications", label: "Applications" },
  { id: "meals", label: "Meals" },
  { id: "funds", label: "Fees" },
  { id: "disputes", label: "Disputes" },
];

export default function AdminPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [identityReady, setIdentityReady] = useState(false);
  const [tab, setTab] = useState<Tab>("applications");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [requests, setRequests] = useState<InvitationRequest[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});

  // Applications (host + chef).
  const [appStatus, setAppStatus] = useState<Exclude<StatusFilter, "all">>("pending");
  const [hosts, setHosts] = useState<HostApplication[]>([]);
  const [chefs, setChefs] = useState<ChefApplication[]>([]);
  const [appNote, setAppNote] = useState<Record<string, string>>({});

  const [adminMeals, setAdminMeals] = useState<Record<string, unknown>[]>([]);
  const [openDisputes, setOpenDisputes] = useState<Record<string, unknown>[]>([]);
  const [feeEnabled, setFeeEnabled] = useState(true);
  const [feeAmount, setFeeAmount] = useState("0");
  const [disputeNote, setDisputeNote] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    if (filter === "all") return requests;
    return requests.filter((r) => r.status === filter);
  }, [requests, filter]);

  const loadRequests = useCallback(async () => {
    setLoadError(null);
    try {
      const qs = filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
      const res = await fetchAuthed(netlifyFunctionUrl(`admin-list-invitation-requests${qs}`));
      const json = (await res.json()) as { ok?: boolean; requests?: InvitationRequest[]; error?: string };
      if (!res.ok) {
        const detail =
          typeof json === "object" && json && "detail" in json
            ? String((json as { detail?: unknown }).detail)
            : "";
        throw new Error(detail || (json.error ?? res.statusText));
      }
      setRequests(json.requests ?? []);
    } catch (e) {
      setRequests([]);
      setLoadError(e instanceof Error ? e.message : "Could not load invitation requests.");
    }
  }, [filter]);

  const loadApplications = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetchAuthed(
        netlifyFunctionUrl(`admin-list-applications?status=${encodeURIComponent(appStatus)}`),
      );
      const json = (await res.json()) as {
        ok?: boolean;
        hosts?: HostApplication[];
        chefs?: ChefApplication[];
        error?: string;
      };
      if (!res.ok) {
        const detail =
          typeof json === "object" && json && "detail" in json
            ? String((json as { detail?: unknown }).detail)
            : "";
        throw new Error(
          detail || (json.error ?? res.statusText),
        );
      }
      setHosts(json.hosts ?? []);
      setChefs(json.chefs ?? []);
    } catch (e) {
      setHosts([]);
      setChefs([]);
      setLoadError(e instanceof Error ? e.message : "Could not load applications.");
    }
  }, [appStatus]);

  const loadMealsAdmin = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("admin-list-meals"));
      const json = (await res.json()) as {
        meals?: Record<string, unknown>[];
        disputes?: Record<string, unknown>[];
        error?: string;
      };
      if (!res.ok) {
        const detail =
          typeof json === "object" && json && "detail" in json
            ? String((json as { detail?: unknown }).detail)
            : "";
        throw new Error(
          detail || (json.error ?? res.statusText),
        );
      }
      setAdminMeals(json.meals ?? []);
      setOpenDisputes(json.disputes ?? []);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load meals.");
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("admin-platform-settings"));
      const json = (await res.json()) as {
        settings?: { attendance_fee_enabled: boolean; attendance_fee_amount: number };
        error?: string;
      };
      if (!res.ok) {
        const detail =
          typeof json === "object" && json && "detail" in json
            ? String((json as { detail?: unknown }).detail)
            : "";
        throw new Error(
          detail || (json.error ?? res.statusText),
        );
      }
      if (json.settings) {
        setFeeEnabled(json.settings.attendance_fee_enabled);
        setFeeAmount(String(json.settings.attendance_fee_amount));
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load settings.");
    }
  }, []);

  const saveSettings = async () => {
    setBusyId("settings");
    setActionError(null);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("admin-platform-settings"), {
        method: "POST",
        body: JSON.stringify({
          attendanceFeeEnabled: feeEnabled,
          attendanceFeeAmount: Number(feeAmount),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let offAuth: (() => void) | undefined;

    (async () => {
      try {
        const user = await getUser();
        if (cancelled) return;
        if (!user) {
          router.replace("/login/");
          return;
        }
        offAuth = subscribeAuthChange((signedIn) => {
          if (!signedIn) router.replace("/login/");
        });
        setIdentityReady(true);
      } catch {
        router.replace("/login/");
      } finally {
        if (!cancelled) setMounted(true);
      }
    })();

    return () => {
      cancelled = true;
      offAuth?.();
    };
  }, [router]);

  useEffect(() => {
    if (!identityReady) return;
    if (tab === "invitations") void loadRequests();
    else if (tab === "applications") void loadApplications();
    else if (tab === "meals" || tab === "disputes") void loadMealsAdmin();
    else if (tab === "funds") void loadSettings();
  }, [identityReady, tab, loadRequests, loadApplications, loadMealsAdmin, loadSettings]);

  const logout = async () => {
    await signOut();
    router.replace("/login/");
  };

  const approve = async (requestId: string) => {
    setBusyId(requestId);
    setActionError(null);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("admin-approve-invitation-request"), {
        method: "POST",
        body: JSON.stringify({ requestId }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        debug?: { hasEnvToken?: boolean; hasContextToken?: boolean; priorStatus?: string };
      };
      // #region agent log
      fetch("http://127.0.0.1:7791/ingest/9edce051-a32e-42af-9f1a-0a04a0d1bc57", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "2ef69d" },
        body: JSON.stringify({
          sessionId: "2ef69d",
          runId: "ui-debug-surface",
          hypothesisId: "A,B,C,D",
          location: "admin/page.tsx:approve",
          message: "admin invite approve response",
          data: {
            ok: res.ok,
            status: res.status,
            error: json.error ?? null,
            debug: json.debug ?? null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      try {
        localStorage.setItem(
          "debug-2ef69d-approve",
          JSON.stringify({
            at: Date.now(),
            ok: res.ok,
            status: res.status,
            error: json.error ?? null,
            debug: json.debug ?? null,
          }),
        );
      } catch {
        /* ignore */
      }
      // #endregion
      if (!res.ok) {
        const d = json.debug;
        const debugSuffix = d
          ? ` [debug hasEnvToken=${String(d.hasEnvToken)} hasContextToken=${String(d.hasContextToken)} priorStatus=${d.priorStatus ?? "?"}]`
          : " [debug payload missing — deploy may be stale]";
        throw new Error((json.error ?? "Approval failed") + debugSuffix);
      }
      await loadRequests();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Approval failed.");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (requestId: string) => {
    setBusyId(requestId);
    setActionError(null);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("admin-reject-invitation-request"), {
        method: "POST",
        body: JSON.stringify({ requestId, note: rejectNote[requestId] ?? "" }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Rejection failed");
      setRejectNote((prev) => ({ ...prev, [requestId]: "" }));
      await loadRequests();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Rejection failed.");
    } finally {
      setBusyId(null);
    }
  };

  const reviewHost = async (hostId: string, decision: "approve" | "reject") => {
    setBusyId(hostId);
    setActionError(null);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("admin-review-host"), {
        method: "POST",
        body: JSON.stringify({ hostId, decision, note: appNote[hostId] ?? "" }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Review failed");
      setAppNote((prev) => ({ ...prev, [hostId]: "" }));
      await loadApplications();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setBusyId(null);
    }
  };

  const reviewChef = async (chefId: string, decision: "approve" | "reject") => {
    setBusyId(chefId);
    setActionError(null);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("admin-review-chef"), {
        method: "POST",
        body: JSON.stringify({ chefId, decision, note: appNote[chefId] ?? "" }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Review failed");
      setAppNote((prev) => ({ ...prev, [chefId]: "" }));
      await loadApplications();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Review failed.");
    } finally {
      setBusyId(null);
    }
  };

  const resolveDispute = async (disputeId: string, releaseRemainder: boolean) => {
    setBusyId(disputeId);
    setActionError(null);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("admin-resolve-dispute"), {
        method: "POST",
        body: JSON.stringify({
          disputeId,
          resolutionNote: disputeNote[disputeId] ?? "",
          releaseRemainder,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Resolve failed");
      setDisputeNote((prev) => ({ ...prev, [disputeId]: "" }));
      await loadMealsAdmin();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Resolve failed.");
    } finally {
      setBusyId(null);
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
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <Link href="/" className="font-cormorant text-xl text-foreground hover:opacity-90">
            Supper Collective
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="font-geist text-body-sm text-foreground/70 hover:text-foreground"
          >
            Sign out
          </button>
        </div>

        <h1 className="mt-16 font-cormorant text-display-sm font-medium text-foreground">Admin</h1>
        <p className="mt-2 font-geist text-body-sm text-foreground/70">
          Review new guest requests, host and chef applications, meals, and disputes.
        </p>

        <div className="mt-8 flex flex-wrap gap-3 border-b border-white/10">
          {ADMIN_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={[
                "-mb-px border-b-2 px-2 py-3 font-geist text-body-sm transition-colors",
                tab === id
                  ? "border-brass text-brass"
                  : "border-transparent text-foreground/60 hover:text-foreground",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {loadError && (
          <p className="mt-8 rounded border border-terracotta/40 bg-terracotta/10 p-4 font-geist text-body-sm text-terracotta">
            {loadError}
          </p>
        )}
        {actionError && <p className="mt-4 font-geist text-body-sm text-terracotta">{actionError}</p>}

        {tab === "applications" && (
          <>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <span className="font-geist text-body-sm text-foreground/60">Status</span>
              {(["pending", "approved", "rejected"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={!identityReady}
                  onClick={() => setAppStatus(k)}
                  className={[
                    "rounded border px-4 py-2 font-geist text-body-sm capitalize transition-colors",
                    appStatus === k
                      ? "border-brass/60 bg-brass/10 text-brass"
                      : "border-white/15 text-foreground/70 hover:border-white/30 hover:text-foreground",
                  ].join(" ")}
                >
                  {k}
                </button>
              ))}
              <button
                type="button"
                disabled={!identityReady}
                onClick={() => void loadApplications()}
                className="ml-auto rounded border border-foreground/30 px-4 py-2 font-geist text-body-sm text-foreground/80 hover:border-foreground/50"
              >
                Refresh
              </button>
            </div>

            <h2 className="mt-10 font-cormorant text-xl text-foreground">Host applications</h2>
            <div className="mt-4 space-y-4">
              {hosts.length === 0 ? (
                <p className="font-geist text-body-sm text-foreground/60">No host applications.</p>
              ) : (
                hosts.map((h) => (
                  <div key={h.id} className="rounded border border-white/10 bg-charcoal/80 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-geist text-body-md text-foreground">
                          {[h.first_name, h.surname].filter(Boolean).join(" ") || h.email}
                        </p>
                        <p className="mt-1 font-geist text-body-sm text-foreground/60">
                          {h.email}
                          {h.mobile_phone ? ` · ${h.mobile_phone}` : ""}
                        </p>
                      </div>
                      <span className="rounded border border-white/15 px-3 py-1 font-geist text-label uppercase tracking-wider text-foreground/70">
                        {h.approval_status}
                      </span>
                    </div>

                    <dl className="mt-4 space-y-1 font-geist text-body-sm text-foreground/75">
                      <div>
                        <span className="text-foreground/50">Address: </span>
                        <span className="whitespace-pre-wrap">{h.address}</span>
                      </div>
                      {h.allergies && (
                        <div>
                          <span className="text-foreground/50">Allergies: </span>
                          {h.allergies}
                        </div>
                      )}
                      <div>
                        <span className="text-foreground/50">Equipment for 10: </span>
                        cutlery {h.cutlery ? "✓" : "✗"} · glassware {h.glassware ? "✓" : "✗"} · crockery{" "}
                        {h.crockery ? "✓" : "✗"}
                      </div>
                      <div className="flex flex-wrap gap-4">
                        {h.kitchen_photo_url && (
                          <a href={h.kitchen_photo_url} target="_blank" rel="noreferrer" className="text-brass underline">
                            Kitchen photo
                          </a>
                        )}
                        {h.dining_photo_url && (
                          <a href={h.dining_photo_url} target="_blank" rel="noreferrer" className="text-brass underline">
                            Dining photo
                          </a>
                        )}
                      </div>
                      {h.approval_note && (
                        <div>
                          <span className="text-foreground/50">Message: </span>
                          <span className="whitespace-pre-wrap">{h.approval_note}</span>
                        </div>
                      )}
                    </dl>

                    {h.approval_status === "pending" && (
                      <div className="mt-6 space-y-3">
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={busyId === h.id}
                            onClick={() => void reviewHost(h.id, "approve")}
                            className="rounded border border-brass/60 px-5 py-2.5 font-geist text-body-sm text-brass transition-colors hover:bg-brass hover:text-charcoal disabled:opacity-40"
                          >
                            Approve host
                          </button>
                          <button
                            type="button"
                            disabled={busyId === h.id}
                            onClick={() => void reviewHost(h.id, "reject")}
                            className="rounded border border-terracotta/60 px-5 py-2.5 font-geist text-body-sm text-terracotta transition-colors hover:bg-terracotta hover:text-charcoal disabled:opacity-40"
                          >
                            Reject
                          </button>
                        </div>
                        <textarea
                          value={appNote[h.id] ?? ""}
                          onChange={(e) => setAppNote((prev) => ({ ...prev, [h.id]: e.target.value }))}
                          rows={2}
                          placeholder="Optional note for the email"
                          disabled={busyId === h.id}
                          className="w-full resize-none rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 focus:border-brass focus:outline-none disabled:opacity-50"
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <h2 className="mt-12 font-cormorant text-xl text-foreground">Chef applications</h2>
            <div className="mt-4 space-y-4">
              {chefs.length === 0 ? (
                <p className="font-geist text-body-sm text-foreground/60">No chef applications.</p>
              ) : (
                chefs.map((c) => (
                  <div key={c.id} className="rounded border border-white/10 bg-charcoal/80 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-geist text-body-md text-foreground">
                          {[c.first_name, c.surname].filter(Boolean).join(" ") || c.email}
                        </p>
                        <p className="mt-1 font-geist text-body-sm text-foreground/60">
                          {c.email}
                          {c.mobile_phone ? ` · ${c.mobile_phone}` : ""}
                        </p>
                      </div>
                      <span className="rounded border border-white/15 px-3 py-1 font-geist text-label uppercase tracking-wider text-foreground/70">
                        {c.approval_status}
                      </span>
                    </div>

                    <dl className="mt-4 space-y-1 font-geist text-body-sm text-foreground/75">
                      {c.food_genres?.length > 0 && (
                        <div>
                          <span className="text-foreground/50">Genres: </span>
                          {c.food_genres.join(", ")}
                        </div>
                      )}
                      {c.bio && (
                        <div>
                          <span className="text-foreground/50">Bio: </span>
                          <span className="whitespace-pre-wrap">{c.bio}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-4">
                        {c.cv_url && (
                          <a href={c.cv_url} target="_blank" rel="noreferrer" className="text-brass underline">
                            CV
                          </a>
                        )}
                        {c.headshot_url && (
                          <a href={c.headshot_url} target="_blank" rel="noreferrer" className="text-brass underline">
                            Headshot
                          </a>
                        )}
                      </div>
                      {c.references_text && (
                        <div>
                          <span className="text-foreground/50">References: </span>
                          <span className="whitespace-pre-wrap">{c.references_text}</span>
                        </div>
                      )}
                    </dl>

                    {c.approval_status === "pending" && (
                      <div className="mt-6 space-y-3">
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={busyId === c.id}
                            onClick={() => void reviewChef(c.id, "approve")}
                            className="rounded border border-brass/60 px-5 py-2.5 font-geist text-body-sm text-brass transition-colors hover:bg-brass hover:text-charcoal disabled:opacity-40"
                          >
                            Approve chef
                          </button>
                          <button
                            type="button"
                            disabled={busyId === c.id}
                            onClick={() => void reviewChef(c.id, "reject")}
                            className="rounded border border-terracotta/60 px-5 py-2.5 font-geist text-body-sm text-terracotta transition-colors hover:bg-terracotta hover:text-charcoal disabled:opacity-40"
                          >
                            Reject
                          </button>
                        </div>
                        <textarea
                          value={appNote[c.id] ?? ""}
                          onChange={(e) => setAppNote((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          rows={2}
                          placeholder="Optional note for the email"
                          disabled={busyId === c.id}
                          className="w-full resize-none rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 focus:border-brass focus:outline-none disabled:opacity-50"
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === "meals" && (
          <>
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                disabled={!identityReady}
                onClick={() => void loadMealsAdmin()}
                className="rounded border border-foreground/30 px-4 py-2 font-geist text-body-sm text-foreground/80 hover:border-foreground/50"
              >
                Refresh
              </button>
            </div>
            <div className="mt-6 space-y-4">
              {adminMeals.length === 0 ? (
                <p className="font-geist text-body-sm text-foreground/60">No meals yet.</p>
              ) : (
                adminMeals.map((m) => (
                  <div key={String(m.id)} className="rounded border border-white/10 bg-charcoal/80 p-6">
                    <p className="font-geist text-body-md text-foreground">
                      {String(m.title ?? "Untitled")} · {String(m.month)} {String(m.year)}
                    </p>
                    <p className="mt-1 font-geist text-body-sm text-foreground/60">
                      Host {String(m.host_first_name ?? "—")} · Chef {String(m.chef_first_name ?? "—")} ·{" "}
                      {String(m.neighborhood ?? "")}
                    </p>
                    <p className="mt-2 font-geist text-body-sm capitalize text-foreground/80">
                      Status: {String(m.status)}
                      {m.is_visible ? " · visible" : " · hidden"}
                    </p>
                    {Boolean(m.display_date) && (
                      <p className="mt-1 font-geist text-body-sm text-foreground/50">
                        Dinner date: {new Date(String(m.display_date)).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === "funds" && (
          <section className="mt-8 rounded border border-white/10 bg-charcoal/80 p-8">
            <h2 className="font-cormorant text-xl text-foreground">Platform settings</h2>
            <p className="mt-2 font-geist text-body-sm text-foreground/70">
              Global attendance fee toggle (v1 — G1).
            </p>
            <label className="mt-6 flex items-center gap-3 font-geist text-body-sm text-foreground/80">
              <input
                type="checkbox"
                checked={feeEnabled}
                onChange={(e) => setFeeEnabled(e.target.checked)}
                disabled={busyId === "settings"}
              />
              Attendance fee enabled
            </label>
            <div className="mt-4">
              <label className="mb-1 block font-geist text-body-sm text-foreground/70">Fee amount (USD)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={feeAmount}
                onChange={(e) => setFeeAmount(e.target.value)}
                disabled={busyId === "settings"}
                className="w-full max-w-xs rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground"
              />
            </div>
            <button
              type="button"
              disabled={busyId === "settings"}
              onClick={() => void saveSettings()}
              className="mt-6 rounded border border-brass/60 px-5 py-2.5 font-geist text-body-sm text-brass hover:bg-brass hover:text-charcoal disabled:opacity-40"
            >
              Save settings
            </button>
          </section>
        )}

        {tab === "disputes" && (
          <>
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                disabled={!identityReady}
                onClick={() => void loadMealsAdmin()}
                className="rounded border border-foreground/30 px-4 py-2 font-geist text-body-sm text-foreground/80 hover:border-foreground/50"
              >
                Refresh
              </button>
            </div>
            <div className="mt-6 space-y-4">
              {openDisputes.length === 0 ? (
                <p className="font-geist text-body-sm text-foreground/60">No open disputes.</p>
              ) : (
                openDisputes.map((d) => (
                  <div key={String(d.id)} className="rounded border border-white/10 bg-charcoal/80 p-6">
                    <p className="font-geist text-body-md text-foreground">{String(d.title ?? "Meal dispute")}</p>
                    <p className="mt-1 font-geist text-body-sm text-foreground/60">
                      {Boolean(d.display_date) ? new Date(String(d.display_date)).toLocaleDateString() : ""} · opened{" "}
                      {Boolean(d.created_at) ? new Date(String(d.created_at)).toLocaleString() : ""}
                    </p>
                    {Boolean(d.reason) && (
                      <p className="mt-3 whitespace-pre-wrap font-geist text-body-sm text-foreground/75">
                        {String(d.reason)}
                      </p>
                    )}
                    <textarea
                      value={disputeNote[String(d.id)] ?? ""}
                      onChange={(e) => setDisputeNote((prev) => ({ ...prev, [String(d.id)]: e.target.value }))}
                      rows={2}
                      placeholder="Resolution note"
                      disabled={busyId === String(d.id)}
                      className="mt-4 w-full resize-none rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 disabled:opacity-50"
                    />
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={busyId === String(d.id)}
                        onClick={() => void resolveDispute(String(d.id), true)}
                        className="rounded border border-brass/60 px-5 py-2.5 font-geist text-body-sm text-brass disabled:opacity-40"
                      >
                        Resolve & release chef remainder
                      </button>
                      <button
                        type="button"
                        disabled={busyId === String(d.id)}
                        onClick={() => void resolveDispute(String(d.id), false)}
                        className="rounded border border-foreground/60 px-5 py-2.5 font-geist text-body-sm text-foreground disabled:opacity-40"
                      >
                        Resolve without release
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {tab === "invitations" && (
          <>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <span className="font-geist text-body-sm text-foreground/60">Filter</span>
              {(["pending", "approved", "rejected", "all"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={!identityReady}
                  onClick={() => setFilter(k)}
                  className={[
                    "rounded border px-4 py-2 font-geist text-body-sm transition-colors",
                    filter === k
                      ? "border-brass/60 bg-brass/10 text-brass"
                      : "border-white/15 text-foreground/70 hover:border-white/30 hover:text-foreground",
                  ].join(" ")}
                >
                  {k}
                </button>
              ))}
              <button
                type="button"
                disabled={!identityReady}
                onClick={() => void loadRequests()}
                className="ml-auto rounded border border-foreground/30 px-4 py-2 font-geist text-body-sm text-foreground/80 hover:border-foreground/50"
              >
                Refresh
              </button>
            </div>

            <div className="mt-8 space-y-4">
              {filtered.length === 0 ? (
                <p className="font-geist text-body-sm text-foreground/60">No requests.</p>
              ) : (
                filtered.map((r) => (
                  <div key={r.id} className="rounded border border-white/10 bg-charcoal/80 p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-geist text-body-md text-foreground">{r.email}</p>
                        <p className="mt-1 font-geist text-body-sm text-foreground/60">
                          {r.name ? `${r.name} · ` : ""}
                          {r.referred_by ? `Referred by: ${r.referred_by}` : "No referrer"}
                        </p>
                      </div>
                      <span className="rounded border border-white/15 px-3 py-1 font-geist text-label uppercase tracking-wider text-foreground/70">
                        {r.status}
                      </span>
                    </div>

                    <p className="mt-4 whitespace-pre-wrap font-geist text-body-sm text-foreground/75">
                      {r.why_you_love_to_come}
                    </p>

                    {r.status === "pending" ? (
                      <div className="mt-6 space-y-3">
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void approve(r.id)}
                            className="rounded border border-brass/60 px-5 py-2.5 font-geist text-body-sm text-brass transition-colors hover:bg-brass hover:text-charcoal disabled:opacity-40"
                          >
                            Approve & send invite
                          </button>
                          <button
                            type="button"
                            disabled={busyId === r.id}
                            onClick={() => void reject(r.id)}
                            className="rounded border border-terracotta/60 px-5 py-2.5 font-geist text-body-sm text-terracotta transition-colors hover:bg-terracotta hover:text-charcoal disabled:opacity-40"
                          >
                            Reject & email
                          </button>
                        </div>
                        <textarea
                          value={rejectNote[r.id] ?? ""}
                          onChange={(e) => setRejectNote((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          rows={3}
                          placeholder="Optional rejection note to include in the email"
                          disabled={busyId === r.id}
                          className="w-full resize-none rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground placeholder:text-foreground/40 focus:border-brass focus:outline-none disabled:opacity-50"
                        />
                      </div>
                    ) : (
                      <p className="mt-6 font-geist text-body-sm text-foreground/50">
                        Updated {r.approved_at ? new Date(r.approved_at).toLocaleString() : ""}{" "}
                        {r.approved_by ? `by ${r.approved_by}` : ""}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
