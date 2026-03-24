/**
 * Sanity schema: Past Dinner
 * Use in Sanity Studio when connecting CMS.
 */
export const dinnerSchema = {
  name: "dinner",
  title: "Past Dinner",
  type: "document",
  fields: [
    { name: "month", title: "Month", type: "string" },
    { name: "year", title: "Year", type: "number" },
    { name: "neighborhood", title: "Neighborhood", type: "string" },
    { name: "chef", title: "Chef", type: "reference", to: [{ type: "chef" }] },
    { name: "menuLine", title: "Menu (one line)", type: "string" },
    { name: "images", title: "Images", type: "array", of: [{ type: "image", options: { hotspot: true } }] },
  ],
};
