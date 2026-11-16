/** Traditional biorhythms: mathematical entertainment, not health indicators.
 * All arithmetic uses UTC calendar dates, independent of local DST.
 * Do not send or persist birth dates or computed values.
 */
export const BIORHYTHM_CYCLES = [
  { key: "physical", period: 23 },
  { key: "emotional", period: 28 },
  { key: "intellectual", period: 33 },
] as const;
export type BiorhythmCycle = (typeof BIORHYTHM_CYCLES)[number]["key"];
const DAY_MS = 86_400_000;

export function utcDay(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y = NaN, m = NaN, d = NaN] = iso.split("-").map(Number);
  if (!Number.isInteger(y) || y < 1900 || y > 9999 ||
      !Number.isInteger(m) || m < 1 || m > 12 ||
      !Number.isInteger(d) || d < 1 || d > 31) return null;
  const time = Date.UTC(y, m - 1, d);
  const actual = new Date(time);
  if (actual.getUTCFullYear() !== y || actual.getUTCMonth() !== m - 1 || actual.getUTCDate() !== d) return null;
  return Math.round(time / DAY_MS);
}

export function validBirthDate(value: string, today: string): boolean {
  const birth = utcDay(value);
  const current = utcDay(today);
  return birth !== null && current !== null && birth <= current;
}

export function isoAtDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function cycleValue(daysFromBirth: number, period: number): number {
  if (!Number.isInteger(daysFromBirth) || !BIORHYTHM_CYCLES.some(c => c.period === period))
    throw new RangeError("Invalid biorhythm calculation");
  return 100 * Math.sin(2 * Math.PI * (daysFromBirth % period) / period);
}

export type BiorhythmPoint = { date: string; dayOffset: number } & Record<BiorhythmCycle, number>;
export function biorhythmWindow(birthDate: string, centerDate: string): BiorhythmPoint[] {
  const birth = utcDay(birthDate), center = utcDay(centerDate);
  if (birth === null || center === null) throw new RangeError("Invalid birth or center date");
  return Array.from({ length: 31 }, (_, i) => {
    const dateDay = center + i - 15;
    const days = dateDay - birth;
    return {
      date: isoAtDay(dateDay),
      dayOffset: i - 15,
      physical: cycleValue(days, 23),
      emotional: cycleValue(days, 28),
      intellectual: cycleValue(days, 33),
    };
  });
}
