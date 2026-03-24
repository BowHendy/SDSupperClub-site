import { BRAND } from "@/lib/mock-data";

export function ContactFooter() {
  return (
    <footer className="border-t border-white/10 bg-charcoal py-12">
      <div className="mx-auto max-w-6xl px-6 text-center md:px-8">
        <div className="flex flex-wrap items-center justify-center gap-6 font-geist text-body-sm text-foreground/80">
          <a
            href={BRAND.contact.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Instagram
          </a>
          <a
            href={`mailto:${BRAND.contact.email}`}
            className="transition-colors hover:text-foreground"
          >
            {BRAND.contact.email}
          </a>
          <span>{BRAND.contact.location}</span>
        </div>
      </div>
    </footer>
  );
}
