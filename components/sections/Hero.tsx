"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useSiteContent } from "@/components/providers/SiteContentProvider";

export function Hero() {
  const { site } = useSiteContent();
  const hero = site.hero;
  return (
    <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-charcoal">
      {/* Full-bleed atmospheric background; add /public/images/hero.jpg for a custom image */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-fig/20 via-charcoal/90 to-charcoal"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <motion.h1
          className="font-cormorant text-display-lg font-medium leading-tight text-parchment"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
        >
          {hero.headline}
        </motion.h1>
        <motion.div
          className="mt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          <Link
            href="/#request-invite"
            className="inline-block rounded border border-parchment/70 px-6 py-3 font-geist text-body-md text-parchment transition-all duration-300 hover:bg-parchment hover:text-charcoal"
          >
            {hero.cta}
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
