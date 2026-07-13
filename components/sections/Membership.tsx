"use client";

import { useSiteContent } from "@/components/providers/SiteContentProvider";
import { FadeIn } from "@/components/ui/FadeIn";

export function Membership() {
  const { site } = useSiteContent();
  const m = site.membership;
  return (
    <section
      id="how-to-join"
      className="scroll-mt-24 border-t border-white/10 bg-charcoal py-24 md:py-32"
    >
      <div className="mx-auto max-w-2xl px-6 md:px-8">
        <FadeIn>
          <h2 className="font-cormorant text-display-sm font-medium text-foreground">
            {m.title}
          </h2>
        </FadeIn>
        <FadeIn delay={0.1}>
          <p className="mt-6 font-geist text-body-lg text-foreground/90">
            {m.intro}
          </p>
        </FadeIn>
        <FadeIn delay={0.2}>
          <h3 className="mt-12 font-cormorant text-xl text-foreground">Live dinners</h3>
          <p className="mt-4 font-geist text-body-md text-foreground/80">
            Browse upcoming dinners in the calendar below and request a seat — you&apos;ll receive an email to create
            your password and join the waitlist.
          </p>
          <p className="mt-4">
            <a href="#calendar" className="font-geist text-body-sm text-brass underline">
              Go to calendar →
            </a>
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
