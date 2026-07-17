/** Calendar-year 21+ check (shared by Forms webhook). */
export function maxEligibleBirthYear(asOf = new Date()): number {
  return asOf.getFullYear() - 21;
}

export function isAtLeast21(birthYear: number, asOf = new Date()): boolean {
  return Number.isFinite(birthYear) && birthYear <= maxEligibleBirthYear(asOf);
}
