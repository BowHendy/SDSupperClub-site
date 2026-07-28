"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAuthed, netlifyFunctionUrl } from "@/lib/netlify-api";

export function ChefWorkspace() {
  const [meals, setMeals] = useState<Record<string, unknown>[]>([]);
  const [payouts, setPayouts] = useState<Record<string, unknown>[]>([]);
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetchAuthed(netlifyFunctionUrl("chef-get-dashboard"));
    const json = (await res.json()) as {
      meals?: Record<string, unknown>[];
      payouts?: Record<string, unknown>[];
      error?: string;
    };
    if (!res.ok) throw new Error(json.error ?? "Failed to load");
    setMeals(json.meals ?? []);
    setPayouts(json.payouts ?? []);
  }, []);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [load]);

  const setPrice = async (dinnerId: string) => {
    const price = Number(priceDraft[dinnerId]);
    if (!Number.isFinite(price) || price <= 0) return;
    setBusy(true);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("chef-set-meal-price"), {
        method: "POST",
        body: JSON.stringify({ dinnerId, pricePerGuest: price }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const dualConfirm = async (dinnerId: string) => {
    setBusy(true);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("meal-dual-confirm"), {
        method: "POST",
        body: JSON.stringify({ dinnerId, role: "chef" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10 space-y-8">
      {error && <p className="text-body-sm text-terracotta">{error}</p>}

      <section className="rounded border border-white/10 bg-charcoal/80 p-8">
        <h2 className="font-cormorant text-xl text-foreground">Assigned meals</h2>
        <ul className="mt-4 space-y-4">
          {meals.length === 0 ? (
            <li className="font-geist text-body-sm text-foreground/60">No assigned meals yet.</li>
          ) : (
            meals.map((m) => (
              <li key={String(m.id)} className="border-b border-white/10 pb-4">
                <p className="font-geist text-body-md text-foreground">
                  {String(m.month)} {String(m.year)} · {String(m.neighborhood)}
                </p>
                <p className="mt-1 font-geist text-body-sm capitalize text-foreground/60">{String(m.status)}</p>
                {!m.meal_price_per_guest && (
                  <div className="mt-3 flex gap-2">
                    <input
                      type="number"
                      placeholder="Price per guest"
                      value={priceDraft[String(m.id)] ?? ""}
                      onChange={(e) =>
                        setPriceDraft((d) => ({ ...d, [String(m.id)]: e.target.value }))
                      }
                      className="rounded border border-white/20 bg-transparent px-3 py-2 font-geist text-foreground"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setPrice(String(m.id))}
                      className="text-body-sm text-brass"
                    >
                      Set price
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  disabled={busy || Boolean(m.chef_confirmed_at)}
                  onClick={() => void dualConfirm(String(m.id))}
                  className="mt-2 block text-body-sm text-foreground/80 underline disabled:opacity-40"
                >
                  {m.chef_confirmed_at ? "Chef confirmed (T−30)" : "Confirm meal proceeds (chef)"}
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded border border-white/10 bg-charcoal/80 p-8">
        <h2 className="font-cormorant text-xl text-foreground">Payouts</h2>
        <ul className="mt-4 space-y-2 font-geist text-body-sm text-foreground/70">
          {payouts.length === 0 ? (
            <li>None yet.</li>
          ) : (
            payouts.map((p) => (
              <li key={String(p.id)}>
                {String(p.kind)} — ${String(p.amount)} ({String(p.status)})
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded border border-white/10 bg-charcoal/80 p-8">
        <h2 className="font-cormorant text-xl text-foreground">Profile</h2>
        <p className="mt-3 font-geist text-body-sm text-foreground/60">
          Skeleton — chef bio, genres, and payout preferences will live here.
        </p>
      </section>
    </div>
  );
}
