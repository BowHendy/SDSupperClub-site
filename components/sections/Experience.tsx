"use client";

import { useSiteContent } from "@/components/providers/SiteContentProvider";
import { FadeIn } from "@/components/ui/FadeIn";

const ICONS: Record<string, string> = {
  frequency: "①",
  guests: "②",
  venue: "③",
  menu: "④",
};

export function Experience() {
  const { site } = useSiteContent();
  const b = site.experience;
  return (
    <section
      id="experience"
      className="scroll-mt-24 border-t border-white/10 bg-charcoal py-24 md:py-32"
    >
      <div className="mx-auto max-w-4xl px-6 md:px-8">
        <FadeIn>
          <h2 className="font-cormorant text-display-sm font-medium text-foreground">
            {b.title}
          </h2>
        </FadeIn>
        <FadeIn delay={0.08}>
          <p className="mt-8 font-geist text-body-lg text-foreground/90 md:text-xl">
            {b.lead}
          </p>
        </FadeIn>
        <ul className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {b.items.map((item, i) => (
            <li key={item.key}>
              <FadeIn delay={0.12 + i * 0.08}>
                <span className="font-cormorant text-2xl text-brass" aria-hidden>
                  {ICONS[item.key] ?? "·"}
                </span>
                <p className="mt-2 font-geist text-body-md text-foreground">{item.label}</p>
              </FadeIn>
            </li>
          ))}
        </ul>
        <FadeIn delay={0.2}>
          <p className="mt-14 font-cormorant text-2xl font-medium leading-snug text-foreground md:text-3xl">
            {b.bridge}
          </p>
        </FadeIn>
        <div className="mt-14 space-y-8 border-t border-white/10 pt-14">
          {b.paragraphs.map((paragraph, i) => (
            <FadeIn key={i} delay={i * 0.1}>
              <p className="font-geist text-body-lg leading-relaxed text-foreground/90">
                {paragraph}
              </p>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={0.25}>
          <div
            className="mt-16 aspect-[4/3] max-w-2xl bg-fig/30"
            role="img"
            aria-label="Moody dinner atmosphere"
          >
            {/* Placeholder for editorial image; add /public/images/experience.jpg */}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
