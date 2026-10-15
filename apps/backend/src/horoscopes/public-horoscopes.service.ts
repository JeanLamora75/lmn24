import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

export const HOROSCOPE_SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
] as const;
export const HOROSCOPE_LOCALES = ["fr", "en", "de", "es", "it", "pt", "ru", "nl"] as const;

export function parisToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function horoscopeWindow(now = new Date()): string[] {
  const today = parisToday(now);
  const base = new Date(`${today}T00:00:00.000Z`);
  return Array.from({ length: 8 }, (_, index) =>
    new Date(base.getTime() + index * 86_400_000).toISOString().slice(0, 10));
}

@Injectable()
export class PublicHoroscopesService {
  constructor(private readonly db: DatabaseService) {}

  async get(sign: string, locale: string, date: string) {
    const record = await this.db.prisma.horoscope.findUnique({
      where: { date_sign_languageIsoCode2: {
        date: new Date(`${date}T00:00:00.000Z`),
        sign,
        languageIsoCode2: locale,
      }},
      select: {
        date: true, sign: true, languageIsoCode2: true,
        general: true, love: true, work: true, finance: true, disclaimer: true,
        astronomySnapshot: { select: { astronomy: true } },
      },
    });
    if (!record) return { available: false, date, sign, language: locale };
    const raw = record.astronomySnapshot.astronomy;
    const metadata = raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw as Record<string, unknown> : {};
    const attribution = metadata.attribution;
    const sourceAttribution = attribution && typeof attribution === "object"
      && !Array.isArray(attribution) ? attribution as Record<string, unknown> : {};
    return {
      available: true, date, sign, language: locale,
      general: record.general, love: record.love, work: record.work,
      finance: record.finance, disclaimer: record.disclaimer,
      astronomy: {
        validationStatus: typeof metadata.validationStatus === "string"
          ? metadata.validationStatus : null,
        attribution: {
          text: typeof sourceAttribution.text === "string" ? sourceAttribution.text : null,
          url: typeof sourceAttribution.url === "string" ? sourceAttribution.url : null,
        },
      },
    };
  }
}
