"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSiteContent } from "@/components/providers/SiteContentProvider";
import { FadeIn } from "@/components/ui/FadeIn";
import { MealRequestForm } from "@/components/ui/MealRequestForm";
import { netlifyFunctionUrl } from "@/lib/netlify-paths";

type Meal = {
  id: string;
  month: string;
  year: number;
  neighborhood: string;
  chef_name: string;
  title: string | null;
  status: string;
  isFull?: boolean;
};

export function UpcomingDinner() {
  const { site } = useSiteContent();
  const fallback = site.upcomingFallback;
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState<Meal[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(netlifyFunctionUrl("get-public-meals"));
        const data = (await res.json()) as { meals?: Meal[] };
        if (cancelled) return;
        setMeals(data.meals ?? []);
      } catch {
        if (!cancelled) setMeals([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="calendar" className="scroll-mt-24 border-t border-white/10 bg-charcoal py-24 md:py-32">
      <div className="mx-auto max-w-2xl px-6 md:px-8">
        <FadeIn>
          <h2 className="font-cormorant text-display-sm font-medium text-foreground">Upcoming Dinners</h2>
          <p className="mt-4 font-geist text-body-sm text-foreground/70">
            Meals appear here after host and chef confirm at T−30. Request a seat to get started.
          </p>
        </FadeIn>

        {loading ? (
          <div className="mt-8 animate-pulse space-y-3">
            <div className="h-24 rounded bg-white/10" />
          </div>
        ) : meals.length === 0 ? (
          <FadeIn delay={0.1}>
            <div className="mt-8 rounded border border-white/15 bg-charcoal/80 p-8">
              <p className="font-geist text-label uppercase tracking-wider text-brass">
                {fallback.month} {fallback.year} · {fallback.neighborhood}
              </p>
              <p className="mt-2 font-cormorant text-xl text-foreground">Chef {fallback.chefName}</p>
              <p className="mt-4 font-geist text-body-sm text-foreground/60">
                The next dinner will be announced here when seats open.
              </p>
            </div>
          </FadeIn>
        ) : (
          <div className="mt-8 space-y-8">
            {meals.map((meal) => (
              <FadeIn key={meal.id} delay={0.05}>
                <div className="rounded border border-white/15 bg-charcoal/80 p-8">
                  <p className="font-geist text-label uppercase tracking-wider text-brass">
                    {meal.month} {meal.year} · {meal.neighborhood}
                  </p>
                  {meal.title && (
                    <p className="mt-1 font-geist text-body-sm text-foreground/80">{meal.title}</p>
                  )}
                  <p className="mt-2 font-cormorant text-xl text-foreground">Chef {meal.chef_name}</p>
                  {meal.isFull || meal.status === "full" ? (
                    <p className="mt-4 inline-block rounded border border-brass/50 px-3 py-1 font-geist text-label uppercase text-brass">
                      Full
                    </p>
                  ) : (
                    <>
                      <div className="mt-6">
                        <MealRequestForm
                          dinnerId={meal.id}
                          dinnerLabel={`${meal.month} ${meal.year}`}
                        />
                      </div>
                      <p className="mt-4 font-geist text-body-sm text-foreground/60">
                        Already have an account?{" "}
                        <Link href="/login/" className="text-brass underline">
                          Log in
                        </Link>
                      </p>
                    </>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
