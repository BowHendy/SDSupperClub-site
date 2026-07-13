"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSiteContent } from "@/components/providers/SiteContentProvider";
import { FadeIn } from "@/components/ui/FadeIn";
import { formatDinnerDate } from "@/lib/format-dinner-date";
import { netlifyFunctionUrl } from "@/lib/netlify-paths";

type MealSummary = {
  id?: string;
  month: string;
  year: number;
  neighborhood: string;
  chef_name?: string;
  display_date?: string | null;
  status?: string;
  isFull?: boolean;
};

export function UpcomingDinner() {
  const { site } = useSiteContent();
  const fallback = site.upcomingFallback;
  const [loading, setLoading] = useState(true);
  const [meal, setMeal] = useState<MealSummary | null>(null);
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(netlifyFunctionUrl("get-active-meal"));
        const data = (await res.json()) as {
          meal?: Record<string, unknown> | null;
          isFull?: boolean;
        };
        if (cancelled) return;
        const m = data.meal;
        if (m && typeof m.month === "string" && typeof m.year === "number") {
          setMeal({
            id: typeof m.id === "string" ? m.id : undefined,
            month: m.month,
            year: m.year,
            neighborhood: typeof m.neighborhood === "string" ? m.neighborhood : fallback.neighborhood,
            chef_name: typeof m.chef_name === "string" ? m.chef_name : fallback.chefName,
            display_date: typeof m.display_date === "string" ? m.display_date : null,
            status: typeof m.status === "string" ? m.status : undefined,
          });
          setIsFull(Boolean(data.isFull));
        } else {
          setMeal(null);
        }
      } catch {
        if (!cancelled) setMeal(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fallback.chefName, fallback.neighborhood]);

  const summary: MealSummary = meal ?? {
    month: fallback.month,
    year: fallback.year,
    neighborhood: fallback.neighborhood,
    chef_name: fallback.chefName,
  };

  const dateLabel = formatDinnerDate(summary);
  const locationLabel = summary.neighborhood;

  return (
    <section id="calendar" className="scroll-mt-24 border-t border-white/10 bg-charcoal py-24 md:py-32">
      <div className="mx-auto max-w-2xl px-6 md:px-8">
        <FadeIn>
          <h2 className="font-cormorant text-display-sm font-medium text-foreground">
            Upcoming Dinner
          </h2>
          <p className="mt-4 font-geist text-body-sm text-foreground/70">
            The next gathering on the calendar. Log in to request a seat once your membership
            application has been approved.
          </p>
        </FadeIn>

        {loading ? (
          <div className="mt-8 animate-pulse">
            <div className="h-32 rounded bg-white/10" />
          </div>
        ) : (
          <FadeIn delay={0.1}>
            <div className="mt-8 rounded border border-white/15 bg-charcoal/80 p-8">
              <dl className="space-y-4">
                <div>
                  <dt className="font-geist text-label uppercase tracking-wider text-brass">Date</dt>
                  <dd className="mt-1 font-cormorant text-xl text-foreground">{dateLabel}</dd>
                </div>
                <div>
                  <dt className="font-geist text-label uppercase tracking-wider text-brass">
                    Location
                  </dt>
                  <dd className="mt-1 font-cormorant text-xl text-foreground">{locationLabel}</dd>
                </div>
                {summary.chef_name && summary.chef_name !== "TBA" && (
                  <div>
                    <dt className="font-geist text-label uppercase tracking-wider text-brass">Chef</dt>
                    <dd className="mt-1 font-geist text-body-md text-foreground/90">
                      {summary.chef_name}
                    </dd>
                  </div>
                )}
              </dl>

              {isFull ? (
                <p className="mt-6 inline-block rounded border border-brass/50 px-3 py-1 font-geist text-label uppercase text-brass">
                  Full
                </p>
              ) : (
                <div className="mt-8">
                  <Link
                    href="/login/"
                    className="inline-block rounded border border-foreground/60 px-5 py-2.5 font-geist text-body-sm text-foreground transition-all duration-300 hover:border-foreground hover:bg-foreground hover:text-background"
                  >
                    Log in to request a seat
                  </Link>
                  <p className="mt-4 font-geist text-body-sm text-foreground/60">
                    New here?{" "}
                    <a href="#request-invite" className="text-brass underline">
                      Request to join the community
                    </a>{" "}
                    first.
                  </p>
                </div>
              )}
            </div>
          </FadeIn>
        )}
      </div>
    </section>
  );
}
