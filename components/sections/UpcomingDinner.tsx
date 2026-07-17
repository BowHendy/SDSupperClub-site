"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FadeIn } from "@/components/ui/FadeIn";
import { isSignedIn } from "@/lib/auth-session";
import { getAccessToken } from "@/lib/netlify-access-token";
import { homeForRole, type PrimaryRole } from "@/lib/role-routes";
import { fetchAuthed, netlifyFunctionUrl } from "@/lib/netlify-api";

type PublicMeal = {
  date: string | null;
  zip: string | null;
  neighborhood?: string;
  chefFirstName?: string | null;
  status?: string;
};

function formatLocalDate(dateValue: string | null): string {
  if (!dateValue) return "Date TBA";
  // ISO date YYYY-MM-DD → local calendar day
  if (/^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
    const d = new Date(`${dateValue.slice(0, 10)}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  }
  return dateValue;
}

function getBrowserPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
    );
  });
}

export function UpcomingDinner() {
  const [loading, setLoading] = useState(true);
  const [meal, setMeal] = useState<PublicMeal | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [roleHome, setRoleHome] = useState("/guest/");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const authed = await isSignedIn();
      if (cancelled) return;
      setSignedIn(authed);

      if (authed) {
        try {
          const summaryRes = await fetchAuthed(netlifyFunctionUrl("get-member-summary"));
          const summary = (await summaryRes.json()) as { primaryRole?: PrimaryRole };
          if (!cancelled && summary.primaryRole) {
            setRoleHome(homeForRole(summary.primaryRole));
          }
        } catch {
          /* keep /guest/ */
        }
      }

      const coords = await getBrowserPosition();
      if (cancelled) return;

      const qs = new URLSearchParams();
      if (coords) {
        qs.set("lat", String(coords.lat));
        qs.set("lng", String(coords.lng));
      }
      const url = netlifyFunctionUrl(`get-active-meal${qs.toString() ? `?${qs}` : ""}`);

      try {
        const headers: HeadersInit = {};
        if (authed) {
          const token = await getAccessToken();
          if (token) headers.Authorization = `Bearer ${token}`;
        }
        const res = await fetch(url, { headers });
        const data = (await res.json()) as { meal?: PublicMeal | null };
        if (!cancelled) setMeal(data.meal ?? null);
      } catch {
        if (!cancelled) setMeal(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dateLabel = formatLocalDate(meal?.date ?? null);
  const zipLabel = meal?.zip ? meal.zip : null;

  return (
    <section id="calendar" className="scroll-mt-24 border-t border-white/10 bg-charcoal py-24 md:py-32">
      <div className="mx-auto max-w-2xl px-6 md:px-8">
        <FadeIn>
          <h2 className="font-cormorant text-display-sm font-medium text-foreground">
            Upcoming Dinner
          </h2>
          <p className="mt-4 font-geist text-body-sm text-foreground/70">
            The next gathering near you. Sign in to see more detail and request a seat from your
            guest home.
          </p>
        </FadeIn>

        {loading ? (
          <div className="mt-8 animate-pulse">
            <div className="h-32 rounded bg-white/10" />
          </div>
        ) : (
          <FadeIn delay={0.1}>
            <div className="mt-8 rounded border border-white/15 bg-charcoal/80 p-8">
              {!meal ? (
                <p className="font-geist text-body-sm text-foreground/70">
                  No public dinner is on the calendar yet.{" "}
                  <a href="#request-invite" className="text-brass underline">
                    Request to join
                  </a>{" "}
                  and we&apos;ll be in touch.
                </p>
              ) : (
                <>
                  <dl className="space-y-4">
                    <div>
                      <dt className="font-geist text-label uppercase tracking-wider text-brass">Date</dt>
                      <dd className="mt-1 font-cormorant text-xl text-foreground">{dateLabel}</dd>
                    </div>
                    <div>
                      <dt className="font-geist text-label uppercase tracking-wider text-brass">Area</dt>
                      <dd className="mt-1 font-cormorant text-xl text-foreground">
                        {zipLabel ? `ZIP ${zipLabel}` : "Area TBA"}
                      </dd>
                    </div>
                    {signedIn && meal.neighborhood && (
                      <div>
                        <dt className="font-geist text-label uppercase tracking-wider text-brass">
                          Neighborhood
                        </dt>
                        <dd className="mt-1 font-cormorant text-xl text-foreground">{meal.neighborhood}</dd>
                      </div>
                    )}
                    {signedIn && meal.chefFirstName && (
                      <div>
                        <dt className="font-geist text-label uppercase tracking-wider text-brass">Chef</dt>
                        <dd className="mt-1 font-geist text-body-md text-foreground/90">
                          {meal.chefFirstName}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-8 flex flex-wrap gap-3">
                    {signedIn ? (
                      <Link
                        href={roleHome}
                        className="inline-block rounded border border-foreground/60 px-5 py-2.5 font-geist text-body-sm text-foreground transition-all duration-300 hover:border-foreground hover:bg-foreground hover:text-background"
                      >
                        Request a seat in your account
                      </Link>
                    ) : (
                      <>
                        <a
                          href="#request-invite"
                          className="inline-block rounded border border-brass/60 px-5 py-2.5 font-geist text-body-sm text-brass transition-colors hover:bg-brass hover:text-charcoal"
                        >
                          Request to join
                        </a>
                        <Link
                          href="/login/"
                          className="inline-block rounded border border-foreground/60 px-5 py-2.5 font-geist text-body-sm text-foreground transition-all duration-300 hover:border-foreground hover:bg-foreground hover:text-background"
                        >
                          Sign in
                        </Link>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </FadeIn>
        )}
      </div>
    </section>
  );
}
