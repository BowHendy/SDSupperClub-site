import Image from "next/image";
import { FadeIn } from "@/components/ui/FadeIn";
import { PAST_DINNERS } from "@/lib/mock-data";

export function PastMenus() {
  return (
    <section
      id="past-menus"
      className="scroll-mt-24 border-t border-white/10 bg-charcoal py-24 md:py-32"
    >
      <div className="mx-auto max-w-6xl px-6 md:px-8">
        <FadeIn>
          <h2 className="font-cormorant text-display-sm font-medium text-foreground">
            Past Menus
          </h2>
          <p className="mt-4 max-w-2xl font-geist text-body-md text-foreground/75">
            Printed menus from past dinners—each one a snapshot of that night&apos;s courses.
          </p>
        </FadeIn>
        <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-2 lg:gap-12">
          {PAST_DINNERS.map((dinner, i) => (
            <FadeIn key={dinner.id} delay={i * 0.08}>
              <article className="group flex flex-col">
                <div
                  className="relative overflow-hidden rounded-sm border border-white/12 bg-parchment/[0.06] shadow-lg"
                  style={{ aspectRatio: "3 / 5" }}
                >
                  {dinner.imageUrl ? (
                    <Image
                      src={dinner.imageUrl}
                      alt={`Menu from ${dinner.month} ${dinner.year}, ${dinner.chefName}`}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                    />
                  ) : (
                    <div className="flex h-full flex-col justify-between p-6 md:p-8">
                      <div>
                        <p className="font-geist text-label uppercase tracking-[0.2em] text-brass/90">
                          Menu
                        </p>
                        <p className="mt-6 font-cormorant text-2xl font-medium leading-snug text-foreground md:text-3xl">
                          {dinner.menuLine}
                        </p>
                      </div>
                      <div className="border-t border-white/10 pt-6">
                        <p className="font-geist text-body-sm text-foreground/60">
                          {dinner.month} {dinner.year}
                        </p>
                        <p className="mt-1 font-cormorant text-lg text-foreground/90">
                          {dinner.chefName}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <p className="font-geist text-label uppercase tracking-wider text-brass">
                    {dinner.month} {dinner.year} · {dinner.neighborhood}
                  </p>
                  <p className="mt-1 font-cormorant text-xl text-foreground">{dinner.chefName}</p>
                  {dinner.imageUrl ? (
                    <p className="mt-1 font-geist text-body-md text-foreground/80">
                      {dinner.menuLine}
                    </p>
                  ) : null}
                </div>
              </article>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
