"use client";

import { useSiteContent } from "@/components/providers/SiteContentProvider";
import { FadeIn } from "@/components/ui/FadeIn";
import { InviteForm } from "@/components/ui/InviteForm";

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
        <span id="request-invite" className="scroll-mt-24" aria-hidden />
        <FadeIn delay={0.2}>
          <h3 className="mt-12 font-cormorant text-xl text-foreground">
            {m.formTitle}
          </h3>
          <div className="mt-8">
            <InviteForm />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
