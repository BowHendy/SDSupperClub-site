import Link from "next/link";
import { FadeIn } from "@/components/ui/FadeIn";
import { UPCOMING_DINNER } from "@/lib/mock-data";

export function UpcomingDinner() {
  return (
    <section
      id="calendar"
      className="scroll-mt-24 border-t border-white/10 bg-charcoal py-24 md:py-32"
    >
      <div className="mx-auto max-w-2xl px-6 md:px-8">
        <FadeIn>
          <h2 className="font-cormorant text-display-sm font-medium text-foreground">
            Upcoming Dinner
          </h2>
        </FadeIn>
        <FadeIn delay={0.1}>
          <div className="mt-8 rounded border border-white/15 bg-charcoal/80 p-8 backdrop-blur-sm">
            <p className="font-geist text-label uppercase tracking-wider text-brass">
              {UPCOMING_DINNER.month} {UPCOMING_DINNER.year} · {UPCOMING_DINNER.neighborhood}
            </p>
            <p className="mt-2 font-cormorant text-xl text-foreground">
              Chef {UPCOMING_DINNER.chefName}
            </p>
            <p className="mt-6">
              <Link
                href="/login/"
                className="inline-block rounded border border-foreground/60 px-5 py-2.5 font-geist text-body-sm text-foreground transition-all duration-300 hover:border-foreground hover:bg-foreground hover:text-background"
              >
                {UPCOMING_DINNER.cta}
              </Link>
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
