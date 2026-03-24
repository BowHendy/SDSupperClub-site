/**
 * Sanity schema: Chef
 * Use in Sanity Studio when connecting CMS.
 * See https://www.sanity.io/docs/schema-types
 */
export const chefSchema = {
  name: "chef",
  title: "Chef",
  type: "document",
  fields: [
    { name: "name", title: "Name", type: "string" },
    { name: "slug", title: "Slug", type: "slug", options: { source: "name" } },
    { name: "bio", title: "Bio", type: "text" },
    { name: "image", title: "Image", type: "image", options: { hotspot: true } },
  ],
};
