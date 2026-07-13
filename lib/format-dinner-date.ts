/** Format dinner date for public summary cards. */
export function formatDinnerDate(meal: {
  display_date?: string | null;
  month: string;
  year: number;
}): string {
  if (meal.display_date) {
    const d = new Date(`${meal.display_date}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  }
  return `${meal.month} ${meal.year}`;
}
