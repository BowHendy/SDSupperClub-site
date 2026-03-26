import type { Handler } from "@netlify/functions";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

type MealRow = {
  id: string;
  month: string;
  year: number;
  neighborhood: string;
  chef_name: string;
  menu_line: string | null;
  title: string | null;
  image_url: string | null;
  image_url_2: string | null;
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const rows = (await sql`
      SELECT id, month, year, neighborhood, chef_name, menu_line, title, image_url, image_url_2
      FROM meals
      WHERE status = 'past' AND is_visible = true
      ORDER BY display_date DESC NULLS LAST, year DESC, created_at DESC
    `) as MealRow[];

    const meals = rows.map((r) => ({
      id: r.id,
      month: r.month,
      year: r.year,
      neighborhood: r.neighborhood,
      chefName: r.chef_name,
      menuLine: r.menu_line ?? r.title ?? "",
      imageUrl: r.image_url ?? undefined,
      imageUrl2: r.image_url_2 ?? undefined,
    }));

    return { statusCode: 200, headers: jsonHeaders, body: JSON.stringify({ meals }) };
  } catch (e) {
    console.error("get-past-meals", e);
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ error: String(e) }),
    };
  }
};
