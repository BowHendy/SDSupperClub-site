/** True if someone born in `birthYear` is at least 21 by calendar year (birth-year dropdown). */
export function isAtLeast21(birthYear: number, asOf = new Date()): boolean {
  const year = asOf.getFullYear();
  return year - birthYear >= 21;
}

export function birthYearOptions(asOf = new Date()): number[] {
  const current = asOf.getFullYear();
  const oldest = current - 100;
  const years: number[] = [];
  for (let y = current; y >= oldest; y--) {
    years.push(y);
  }
  return years;
}
