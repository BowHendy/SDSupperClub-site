export const BRAND = {
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
} as const;

export type PastDinner = {
  id: string;
  month: string;
  year: number;
  neighborhood: string;
  chefName: string;
  menuLine: string;
  imageUrl?: string;
  imageUrl2?: string;
};

export const PAST_DINNERS: PastDinner[] = [
  {
    id: "1",
    month: "February",
    year: 2025,
    neighborhood: "North Park",
    chefName: "Chef Luisa Reyes",
    menuLine: "Wood-fired lamb, citrus, smoke.",
  },
  {
    id: "2",
    month: "January",
    year: 2025,
    neighborhood: "Ocean Beach",
    chefName: "Chef Marcus Webb",
    menuLine: "Spot prawns, fermented greens, sea lettuce.",
  },
  {
    id: "3",
    month: "December",
    year: 2024,
    neighborhood: "South Park",
    chefName: "Chef Yuki Tanaka",
    menuLine: "Duck two ways, persimmon, black garlic.",
  },
  {
    id: "4",
    month: "October",
    year: 2024,
    neighborhood: "Bankers Hill",
    chefName: "Chef Ana Rivera",
    menuLine: "Squash blossoms, goat cheese, honey.",
  },
];

export type UpcomingDinner = {
  month: string;
  year: number;
  neighborhood: string;
  chefName: string;
  cta: string;
};

export const UPCOMING_DINNER: UpcomingDinner = {
  month: "March",
  year: 2025,
  neighborhood: "Mission Hills",
  chefName: "TBA",
  cta: "Confirm Your Seat",
};

export type Chef = {
  id: string;
  name: string;
  bio?: string;
};

export const CHEFS: Chef[] = PAST_DINNERS.reduce(
  (acc, d) => {
    if (!acc.some((c) => c.name === d.chefName)) {
      acc.push({ id: d.chefName.toLowerCase().replace(/\s+/g, "-"), name: d.chefName });
    }
    return acc;
  },
  [] as Chef[],
);
