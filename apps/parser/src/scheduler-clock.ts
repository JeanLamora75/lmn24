/** SCRUM-84: deterministic due-date calculations, without starting any parser. */
export type Schedule = {
  parserType: "INFOS" | "VIDEOS" | "WEATHER" | "HOROSCOPE_IMPORT";
  intervalMinutes: number | null;
  localTime: string | null;
  timezone: string;
};

function parisParts(at: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(at);
  const read = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  return { date: read("year") + "-" + read("month") + "-" + read("day"),
    time: read("hour") + ":" + read("minute") };
}

/**
 * First scheduled instant STRICTLY AFTER 'after'. Intervals align to Unix UTC
 * hour boundaries, so DST cannot double-trigger periodic work.
 * Horoscope uses a Paris civil day (06:00 or later), not 24h after last run.
 */
export function nextScheduledAt(config: Schedule, after: Date): Date {
  if (!Number.isFinite(after.getTime())) throw new Error("Invalid reference date");
  if (config.parserType !== "HOROSCOPE_IMPORT") {
    const minutes = config.intervalMinutes;
    if (!minutes || !Number.isInteger(minutes) || minutes < 15 ||
        minutes > 1440) {
      throw new Error("Invalid periodic interval");
    }
    const quantum = minutes * 60_000;
    return new Date((Math.floor(after.getTime() / quantum) + 1) * quantum);
  }
  if (config.timezone !== "Europe/Paris") throw new Error("Unsupported horoscope timezone");
  const target = config.localTime;
  if (!target || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(target) ||
      target < "06:00") throw new Error("Invalid horoscope time");
  // Search bounded UTC minutes. 06:00+ Paris time is unambiguous around DST
  // transitions (which occur around 02:00/03:00).
  const start = Math.floor(after.getTime() / 60_000) * 60_000 + 60_000;
  for (let n = 0; n < 3 * 24 * 60; n++) {
    const candidate = new Date(start + n * 60_000);
    if (parisParts(candidate).time === target) return candidate;
  }
  throw new Error("Could not compute next Paris local execution");
}
