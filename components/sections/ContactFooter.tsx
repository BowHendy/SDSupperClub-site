"use client";

import { useSiteContent } from "@/components/providers/SiteContentProvider";

export function ContactFooter() {
  const { site } = useSiteContent();
  const c = site.contact;
  return (
    <footer className="border-t border-white/10 bg-charcoal py-12">
      <div className="mx-auto max-w-6xl px-6 text-center md:px-8">
        <div className="flex flex-wrap items-center justify-center gap-6 font-geist text-body-sm text-foreground/80">
          <a
            href={c.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Instagram
          </a>
          <a
            href={`mailto:${c.email}`}
            className="transition-colors hover:text-foreground"
          >
            {c.email}
          </a>
          <span>{c.location}</span>
        </div>
      </div>
    </footer>
  );
}
