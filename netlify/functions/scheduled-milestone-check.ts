import type { Handler } from "@netlify/functions";
import { countPaidSeats, daysUntilDisplayDate } from "./lib/meal";
import { recordPayout } from "./lib/stripe";
import { sendEmail } from "./lib/email";
import { buildT14WarningEmail } from "./lib/email-templates";
import { sql } from "./lib/db";

const jsonHeaders = { "Content-Type": "application/json" };

/** Daily cron: T−14 warnings, T−7 ingredient auto-pay or auto-cancel, archive past meals. */
export const handler: Handler = async () => {
  try {
    const meals = await sql`
      SELECT d.*, h.email AS host_email, h.first_name AS host_first_name, c.id AS chef_id
      FROM dinners d
      LEFT JOIN hosts h ON h.id = d.host_id
      LEFT JOIN chefs c ON c.id = d.chef_id
      WHERE d.status IN ('live', 'full', 'subsidy_pending')
        AND d.display_date IS NOT NULL
    `;

    let processed = 0;
    for (const meal of meals as Record<string, unknown>[]) {
      const dinnerId = meal.id as string;
      const days = daysUntilDisplayDate(meal.display_date as string);
      if (days == null) continue;

      const paid = await countPaidSeats(dinnerId);
      const maxSeats = meal.max_seats as number;
      const price = Number(meal.meal_price_per_guest) || 0;
      const pot = price * maxSeats;

      // T−14: warning at ≤8 paid (EC2)
      if (days <= 14 && days > 7 && !meal.t14_warning_sent) {
        if (paid <= 8) {
          if (meal.host_email) {
            try {
              const mail = buildT14WarningEmail(meal.host_first_name as string | null, paid);
              await sendEmail({
                to: meal.host_email as string,
                subject: mail.subject,
                text: mail.text,
                html: mail.html,
              });
            } catch (e) {
              console.error("milestone-check t14 email", e);
            }
          }
          await sql`
            UPDATE dinners SET t14_warning_sent = true, subsidy_required = true
            WHERE id = ${dinnerId}
          `;
        } else {
          await sql`UPDATE dinners SET t14_warning_sent = true WHERE id = ${dinnerId}`;
        }
        processed++;
      }

      // T−7: ingredient pay or auto-cancel
      if (days <= 7 && !meal.t7_ingredient_paid) {
        const subsidyOk = paid >= 8 || Number(meal.subsidy_paid_amount) > 0;
        if (subsidyOk && meal.chef_id && pot > 0) {
          const ingredientAmount = pot * 0.5;
          await recordPayout({
            dinnerId,
            chefId: meal.chef_id as string,
            kind: "chef_ingredient_auto",
            amount: ingredientAmount,
            status: "paid",
          });
          await sql`
            UPDATE dinners SET t7_ingredient_paid = true WHERE id = ${dinnerId}
          `;
        } else if (!subsidyOk) {
          // Auto-cancel + refund guests (EC5: full refund seat + fee)
          await sql`
            UPDATE dinner_guests
            SET status = 'cancelled', cancelled_at = now(), refunded_at = now()
            WHERE dinner_id = ${dinnerId} AND status IN ('paid', 'confirmed', 'approved', 'waitlisted')
          `;
          await sql`
            UPDATE payments SET status = 'refunded', updated_at = now()
            WHERE dinner_id = ${dinnerId} AND status = 'held'
          `;
          await sql`
            UPDATE dinners
            SET status = 'cancelled', cancelled_at = now(), cancel_reason = 'auto_cancel_t7_insufficient_fill'
            WHERE id = ${dinnerId}
          `;
        }
        processed++;
      }
    }

    // Archive past meals
    await sql`
      UPDATE dinners SET status = 'past', is_visible = false
      WHERE display_date < CURRENT_DATE - INTERVAL '1 day'
        AND status IN ('complete', 'live', 'full')
    `;

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ ok: true, processed }),
    };
  } catch (e) {
    console.error("scheduled-milestone-check", e);
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: "Server error" }) };
  }
};
