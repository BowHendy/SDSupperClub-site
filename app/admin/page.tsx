"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { initNetlifyIdentity, loadNetlifyIdentity } from "@/lib/netlify-identity";
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

type StatusFilter = "pending" | "approved" | "rejected" | "all";

export default function AdminPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [identityReady, setIdentityReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [requests, setRequests] = useState<InvitationRequest[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    if (filter === "all") return requests;
    return requests.filter((r) => r.status === filter);
  }, [requests, filter]);

  const loadRequests = useCallback(async () => {
    setLoadError(null);
    try {
      const ni = await loadNetlifyIdentity();
      await ni.refresh();

      const qs = filter === "all" ? "" : `?status=${encodeURIComponent(filter)}`;
      const res = await fetchAuthed(netlifyFunctionUrl(`admin-list-invitation-requests${qs}`));
      const json = (await res.json()) as { ok?: boolean; requests?: InvitationRequest[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setRequests(json.requests ?? []);
    } catch (e) {
      setRequests([]);
      setLoadError(e instanceof Error ? e.message : "Could not load invitation requests.");
    }
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    let offLogout: (() => void) | undefined;

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
        ni.on("logout", () => router.replace("/login/"));
        offLogout = () => ni.off("logout", () => router.replace("/login/"));
        setIdentityReady(true);
      } catch {
        setIdentityReady(true);
      } finally {
        if (!cancelled) setMounted(true);
      }
    })();

    return () => {
      cancelled = true;
      offLogout?.();
    };
  }, [router]);

  useEffect(() => {
    if (!identityReady) return;
    void loadRequests();
  }, [identityReady, loadRequests]);

  const logout = async () => {
    const ni = await loadNetlifyIdentity();
    await ni.logout();
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
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Approval failed");
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
            SD Supper Club
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
        <p className="mt-2 font-geist text-body-sm text-foreground/70">Review membership requests.</p>

        {loadError && (
          <p className="mt-8 rounded border border-terracotta/40 bg-terracotta/10 p-4 font-geist text-body-sm text-terracotta">
            {loadError}
          </p>
        )}
        {actionError && <p className="mt-4 font-geist text-body-sm text-terracotta">{actionError}</p>}

        <div className="mt-10 flex flex-wrap items-center gap-3">
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

                <p className="mt-4 whitespace-pre-wrap font-geist text-body-sm text-foreground/75">{r.why_you_love_to_come}</p>

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
      </div>
    </div>
  );
}

