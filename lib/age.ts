/** Latest birth year that satisfies the 21+ rule for the given date (calendar-year check). */
export function maxEligibleBirthYear(asOf = new Date()): number {
  return asOf.getFullYear() - 21;
}

/** True if someone born in `birthYear` is at least 21 by calendar year (birth-year dropdown). */
export function isAtLeast21(birthYear: number, asOf = new Date()): boolean {
  return birthYear <= maxEligibleBirthYear(asOf);
}

/** Birth years shown in the invite form — only years that meet the 21+ rule. */
export function birthYearOptions(asOf = new Date()): number[] {
  const newest = maxEligibleBirthYear(asOf);
  const oldest = asOf.getFullYear() - 100;
  const years: number[] = [];
  for (let y = newest; y >= oldest; y--) {
    years.push(y);
  }
  return years;
}
