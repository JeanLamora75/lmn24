import { createHash } from "node:crypto";
import { z } from "zod";
import { HOROSCOPE_LOCALES, HOROSCOPE_SIGNS } from "./public-horoscopes.service";

const item = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sign: z.enum(HOROSCOPE_SIGNS),
  language: z.enum(HOROSCOPE_LOCALES),
  general: z.string().trim().min(1),
  love: z.string().trim().min(1),
  work: z.string().trim().min(1),
  finance: z.string().trim().min(1),
  disclaimer: z.string().trim().min(1),
}).passthrough();
const document = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  generatedAt: z.string().datetime({offset:true}),
  timezone: z.literal("Europe/Paris"),
  astronomy: z.object({
    validationStatus: z.string().min(1),
    attribution: z.object({text:z.string().min(1),url:z.string().url()}).passthrough(),
  }).passthrough(),
  horoscopes: z.array(item).length(96),
}).passthrough();

export function validateHoroscopeJson(content: string, fileName: string) {
  if (!/^horoscopes-\d{4}-\d{2}-\d{2}\.json$/.test(fileName)) throw new Error("Nom de fichier invalide.");
  if (Buffer.byteLength(content,"utf8") > 1_500_000) throw new Error("Fichier trop volumineux.");
  let raw:unknown;
  try { raw=JSON.parse(content); } catch { throw new Error("JSON malformé."); }
  const parsed=document.safeParse(raw);
  if (!parsed.success) throw new Error("Structure du fichier Horoscope invalide.");
  const data=parsed.data;
  const civil=new Date(data.date+"T00:00:00.000Z");
  if (!Number.isFinite(civil.getTime())||civil.toISOString().slice(0,10)!==data.date
      ||fileName!==`horoscopes-${data.date}.json`) throw new Error("Date de fichier incohérente.");
  const seen=new Set<string>();
  for (const row of data.horoscopes) {
    if (row.date!==data.date) throw new Error("Dates d'horoscopes divergentes.");
    const key=row.sign+":"+row.language;
    if (seen.has(key)) throw new Error("Combinaisons signe/langue dupliquées.");
    seen.add(key);
  }
  if (seen.size!==96) throw new Error("Fichier incomplet.");
  return {data, fingerprint:createHash("sha256").update(content).digest("hex")};
}
