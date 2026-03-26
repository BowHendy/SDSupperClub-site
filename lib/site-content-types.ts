/** JSON shape stored in site_content.key = 'site' and returned by get-site-content. */

export type SiteExperienceItem = { label: string; key: string };

export type SiteContent = {
  hero: {
    headline: string;
    cta: string;
  };
  experience: {
    title: string;
    lead: string;
    items: SiteExperienceItem[];
    bridge: string;
    paragraphs: string[];
  };
  membership: {
    title: string;
    intro: string;
    formTitle: string;
  };
  contact: {
    instagram: string;
    email: string;
    location: string;
  };
  upcomingFallback: {
    month: string;
    year: number;
    neighborhood: string;
    chefName: string;
    cta: string;
  };
};

export type PastMealRow = {
  id: string;
  month: string;
  year: number;
  neighborhood: string;
  chefName: string;
  menuLine: string;
  imageUrl?: string;
  imageUrl2?: string;
};
