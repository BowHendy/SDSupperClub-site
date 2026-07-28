"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAuthed, netlifyFunctionUrl } from "@/lib/netlify-api";

type Meal = Record<string, unknown>;

export function HostWorkspace() {
  const [meal, setMeal] = useState<Meal | null>(null);
  const [attendees, setAttendees] = useState<Record<string, unknown>[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    month: "",
    year: new Date().getFullYear(),
    neighborhood: "",
    foodGenre: "",
    drinkPairing: "",
    menuLine: "",
    displayDate: "",
  });

  const load = useCallback(async () => {
    const res = await fetchAuthed(netlifyFunctionUrl("host-meal-upsert"));
    const json = (await res.json()) as { meal?: Meal; error?: string };
    if (json.meal) {
      setMeal(json.meal);
      setForm((f) => ({
        ...f,
        title: String(json.meal!.title ?? ""),
        month: String(json.meal!.month ?? ""),
        year: Number(json.meal!.year ?? f.year),
        neighborhood: String(json.meal!.neighborhood ?? ""),
        foodGenre: String(json.meal!.food_genre ?? ""),
        drinkPairing: String(json.meal!.drink_pairing ?? ""),
        menuLine: String(json.meal!.menu_line ?? ""),
        displayDate: json.meal!.display_date ? String(json.meal!.display_date).slice(0, 10) : "",
      }));
      const attRes = await fetchAuthed(
        netlifyFunctionUrl(`host-list-attendees?dinnerId=${encodeURIComponent(String(json.meal!.id))}`),
      );
      const attJson = (await attRes.json()) as { attendees?: Record<string, unknown>[] };
      setAttendees(attJson.attendees ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createMeal = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("host-meal-upsert"), {
        method: "POST",
        body: JSON.stringify(form),
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

  const dualConfirm = async () => {
    if (!meal?.id) return;
    setBusy(true);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("meal-dual-confirm"), {
        method: "POST",
        body: JSON.stringify({ dinnerId: meal.id, role: "host" }),
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

  const reviewAttendee = async (attendeeId: string, decision: "approve" | "reject") => {
    setBusy(true);
    try {
      const res = await fetchAuthed(netlifyFunctionUrl("host-review-attendee"), {
        method: "POST",
        body: JSON.stringify({ attendeeId, decision }),
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
        <h2 className="font-cormorant text-xl text-foreground">My meal</h2>
        {!meal ? (
          <div className="mt-6 space-y-4">
            {(["title", "month", "year", "neighborhood", "foodGenre", "displayDate"] as const).map((key) => (
              <input
                key={key}
                placeholder={key}
                type={key === "year" ? "number" : key === "displayDate" ? "date" : "text"}
                value={String(form[key] ?? "")}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    [key]: key === "year" ? Number(e.target.value) : e.target.value,
                  }))
                }
                className="w-full rounded border border-white/20 bg-transparent px-4 py-3 font-geist text-foreground"
              />
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={() => void createMeal()}
              className="rounded border border-brass/60 px-5 py-2.5 font-geist text-body-sm text-brass hover:bg-brass hover:text-charcoal disabled:opacity-40"
            >
              Create meal draft
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-2 font-geist text-body-sm text-foreground/80">
            <p>
              Status: <span className="capitalize text-foreground">{String(meal.status)}</span>
            </p>
            <p>
              {String(meal.month)} {String(meal.year)} · {String(meal.neighborhood)}
            </p>
            {meal.meal_price_per_guest != null && (
              <p>Price per guest: ${String(meal.meal_price_per_guest)}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy || Boolean(meal.host_confirmed_at)}
                onClick={() => void dualConfirm()}
                className="rounded border border-foreground/60 px-4 py-2 font-geist text-body-sm text-foreground disabled:opacity-40"
              >
                {meal.host_confirmed_at ? "Host confirmed (T−30)" : "Confirm meal proceeds (host)"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void fetchAuthed(netlifyFunctionUrl("host-pay-subsidy"), {
                  method: "POST",
                  body: JSON.stringify({ dinnerId: meal.id }),
                }).then(() => load())}
                className="rounded border border-brass/60 px-4 py-2 font-geist text-body-sm text-brass"
              >
                Pay subsidy
              </button>
            </div>
          </div>
        )}
      </section>

      {meal && (
        <section className="rounded border border-white/10 bg-charcoal/80 p-8">
          <h2 className="font-cormorant text-xl text-foreground">Attendee waitlist</h2>
          <ul className="mt-4 space-y-3">
            {attendees.length === 0 ? (
              <li className="font-geist text-body-sm text-foreground/60">No requests yet.</li>
            ) : (
              attendees.map((a) => (
                <li
                  key={String(a.id)}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3"
                >
                  <span className="font-geist text-body-sm text-foreground">
                    {[a.first_name, a.surname].filter(Boolean).join(" ") || String(a.email)}
                    <span className="ml-2 capitalize text-foreground/50">{String(a.status)}</span>
                  </span>
                  {a.status === "waitlisted" && (
                    <span className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void reviewAttendee(String(a.id), "approve")}
                        className="text-body-sm text-brass"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void reviewAttendee(String(a.id), "reject")}
                        className="text-body-sm text-terracotta"
                      >
                        Reject
                      </button>
                    </span>
                  )}
                  {(a.status === "paid" || a.status === "confirmed") && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void fetchAuthed(netlifyFunctionUrl("host-mark-attended"), {
                          method: "POST",
                          body: JSON.stringify({ dinnerId: meal.id, attendeeId: a.id }),
                        }).then(() => load())
                      }
                      className="text-body-sm text-brass"
                    >
                      Mark attended
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </section>
      )}

      <section className="rounded border border-white/10 bg-charcoal/80 p-8">
        <h2 className="font-cormorant text-xl text-foreground">Meal ops</h2>
        <p className="mt-3 font-geist text-body-sm text-foreground/60">
          Skeleton — fill rate, cancel request, dispute flag, and chef remainder will live here.
        </p>
      </section>
    </div>
  );
}
