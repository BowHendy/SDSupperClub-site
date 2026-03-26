/** @deprecated Use defaultSiteContent / useSiteContent() for marketing copy. */
export { defaultSiteContent as BRAND } from "./default-site-content";

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

/** Fallback when get-past-meals is unavailable or returns no rows. */
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
