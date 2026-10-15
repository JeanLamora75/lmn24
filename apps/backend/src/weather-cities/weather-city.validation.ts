import { z } from "zod";

export const CONTINENTS = ["EU","AS","AF","NA","SA","OC"] as const;

const isIanaTimezone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

export const weatherCityInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120),
  countryIso2: z.string().trim().regex(/^[A-Za-z]{2}$/)
    .transform(value => value.toUpperCase()),
  continentCode: z.enum(CONTINENTS),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  timezone: z.string().trim().min(1).max(64).refine(isIanaTimezone, "Fuseau horaire IANA invalide."),
  displayOrder: z.number().int().min(1).max(32760),
  isActive: z.boolean(),
}).strict();
export type WeatherCityInput = z.infer<typeof weatherCityInputSchema>;

export const weatherCityListSchema = z.object({
  continent: z.enum(["all", ...CONTINENTS]).default("all"),
  status: z.enum(["all","active","inactive"]).default("all"),
  search: z.string().trim().max(120).default(""),
}).strict();

export const weatherCityIdSchema = z.string().uuid();
export const weatherCityStatusSchema = z.object({ isActive: z.boolean() }).strict();
export const weatherCityDeleteSchema = z.object({
  confirmSlug: z.string().min(1).max(120),
}).strict();
