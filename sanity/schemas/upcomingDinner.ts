/**
 * Sanity schema: Upcoming Dinner
 * Single document for the next event.
 */
export const upcomingDinnerSchema = {
  name: "upcomingDinner",
  title: "Upcoming Dinner",
  type: "document",
  fields: [
    { name: "month", title: "Month", type: "string" },
    { name: "year", title: "Year", type: "number" },
    { name: "neighborhood", title: "Neighborhood", type: "string" },
    { name: "chefName", title: "Chef Name (or TBA)", type: "string" },
    { name: "cta", title: "CTA Label", type: "string", initialValue: "Confirm Your Seat" },
  ],
};
