"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSiteContent } from "@/components/providers/SiteContentProvider";
import { FadeIn } from "@/components/ui/FadeIn";
import { netlifyFunctionUrl } from "@/lib/netlify-paths";

type Meal = {
  id: string;
  month: string;
  year: number;
  neighborhood: string;
  chef_name: string;
  status: string;
};

type ActiveMealResponse = {
  meal: Meal | null;
  isFull?: boolean;
  error?: string;
};

export function UpcomingDinner() {
  const { site } = useSiteContent();
  const fallback = site.upcomingFallback;
  const [loading, setLoading] = useState(true);
  const [meal, setMeal] = useState<Meal | null>(null);
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(netlifyFunctionUrl("get-active-meal"));
        const data = (await res.json()) as ActiveMealResponse;
        if (cancelled) return;
        if (res.ok && data.meal) {
          setMeal(data.meal);
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
  }, []);

  const display = meal ?? {
    id: "fallback",
    month: fallback.month,
    year: fallback.year,
    neighborhood: fallback.neighborhood,
    chef_name: fallback.chefName,
    status: "upcoming",
  };

  const showFull = isFull || (meal && meal.status === "full");
  const showCta = !loading && !showFull && (!meal || meal.status === "live");

  return (
    <section
      id="calendar"
      className="scroll-mt-24 border-t border-white/10 bg-charcoal py-24 md:py-32"
    >
      <div className="mx-auto max-w-2xl px-6 md:px-8">
        <FadeIn>
          <h2 className="font-cormorant text-display-sm font-medium text-foreground">Upcoming Dinner</h2>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="mt-8 rounded border border-white/15 bg-charcoal/80 p-8 backdrop-blur-sm">
            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 w-40 rounded bg-white/10" />
                <div className="h-6 w-64 rounded bg-white/10" />
              </div>
            ) : (
              <>
                <p className="font-geist text-label uppercase tracking-wider text-brass">
                  {display.month} {display.year} · {display.neighborhood}
                </p>
                <p className="mt-2 font-cormorant text-xl text-foreground">Chef {display.chef_name}</p>
                {showFull && (
                  <p className="mt-6 inline-block rounded border border-brass/50 px-3 py-1 font-geist text-label uppercase tracking-wider text-brass">
                    Full
                  </p>
                )}
                {showCta && (
                  <p className="mt-6">
                    <Link
                      href="/login/"
                      className="inline-block rounded border border-foreground/60 px-5 py-2.5 font-geist text-body-sm text-foreground transition-all duration-300 hover:border-foreground hover:bg-foreground hover:text-background"
                    >
                      {fallback.cta}
                    </Link>
                  </p>
                )}
                {!showFull && !showCta && meal && (
                  <p className="mt-6 font-geist text-body-sm text-foreground/60">
                    The next dinner will be announced here when seats open.
                  </p>
                )}
              </>
            )}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
