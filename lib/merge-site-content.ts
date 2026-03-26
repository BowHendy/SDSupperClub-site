import { defaultSiteContent } from "./default-site-content";
import type { SiteContent, SiteExperienceItem } from "./site-content-types";

function isExperienceItem(x: unknown): x is SiteExperienceItem {
  return (
    typeof x === "object" &&
    x !== null &&
    "label" in x &&
    typeof (x as SiteExperienceItem).label === "string" &&
    "key" in x &&
    typeof (x as SiteExperienceItem).key === "string"
  );
}

/** Merge API payload with defaults so partial JSON in Neon never breaks the page. */
export function mergeSiteContent(raw: unknown): SiteContent {
  const base = defaultSiteContent;
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;

  const exp = (r.experience && typeof r.experience === "object" ? r.experience : {}) as Partial<
    SiteContent["experience"]
  >;
  const rawItems = exp.items;
  const items = Array.isArray(rawItems) && rawItems.every(isExperienceItem) ? rawItems : base.experience.items;
  const paragraphs = Array.isArray(exp.paragraphs)
    ? exp.paragraphs.filter((p): p is string => typeof p === "string")
    : base.experience.paragraphs;

  const hero =
    r.hero && typeof r.hero === "object"
      ? { ...base.hero, ...(r.hero as Partial<SiteContent["hero"]>) }
      : base.hero;
  const membership =
    r.membership && typeof r.membership === "object"
      ? { ...base.membership, ...(r.membership as Partial<SiteContent["membership"]>) }
      : base.membership;
  const contact =
    r.contact && typeof r.contact === "object"
      ? { ...base.contact, ...(r.contact as Partial<SiteContent["contact"]>) }
      : base.contact;
  const upcoming =
    r.upcomingFallback && typeof r.upcomingFallback === "object"
      ? { ...base.upcomingFallback, ...(r.upcomingFallback as Partial<SiteContent["upcomingFallback"]>) }
      : base.upcomingFallback;

  return {
    hero,
    experience: {
      ...base.experience,
      ...exp,
      items,
      paragraphs: paragraphs.length ? paragraphs : base.experience.paragraphs,
    },
    membership,
    contact,
    upcomingFallback: upcoming,
  };
}
