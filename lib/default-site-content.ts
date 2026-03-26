import type { SiteContent } from "./site-content-types";

/** Used when the API is unavailable or site row is missing. */
export const defaultSiteContent: SiteContent = {
  hero: {
    headline: "Ten seats. One chef. Someone's home. Once a month.",
    cta: "Request an Invitation",
  },
  experience: {
    title: "Good food. Good people. One night a month.",
    lead:
      "Every month a different member hosts — they pick the chef, they pick the drinks, they set the table. It's never the same twice, and that's exactly the point.",
    items: [
      { label: "One dinner per month", key: "frequency" },
      { label: "10 guests, invite-only", key: "guests" },
      { label: "Hosted in a member's San Diego home", key: "venue" },
      { label: "Chef-curated seasonal menu", key: "menu" },
    ],
    bridge: "Every month. Different host, different home, different food.",
    paragraphs: [
      "Whoever's hosting picks what gets cooked and what gets poured. No venues, no menus emailed in advance. Just a real table, people worth meeting, and a meal someone genuinely cared about making.",
      "You leave having eaten well. You also leave with new people in your phone.",
    ],
  },
  membership: {
    title: "How to Join",
    intro:
      "You join by being invited by a current member. Guests can invite one new person per dinner. If you'd like to be considered, tell us a bit about yourself below.",
    formTitle: "Request an Invitation",
  },
  contact: {
    instagram: "https://instagram.com/sdsupperclub",
    email: "hello@sdsupperclub.com",
    location: "San Diego, CA",
  },
  upcomingFallback: {
    month: "March",
    year: 2025,
    neighborhood: "Mission Hills",
    chefName: "TBA",
    cta: "Confirm Your Seat",
  },
};
