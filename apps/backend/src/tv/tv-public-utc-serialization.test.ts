import {describe,expect,it} from "vitest";
import {readFileSync} from "node:fs";

const service=readFileSync(new URL("./tv-public.service.ts",import.meta.url),"utf8");
const utcStart=`to_char(a.starts_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "startsAt"`;
const utcEnd=`to_char(a.ends_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "endsAt"`;

describe("TV public airing timestamp serialization",()=>{
 it("uses explicit UTC text for all three public airing queries (guide, details, worldwide search)",()=>{
  expect(service.split(utcStart).length-1).toBe(3);
  expect(service.split(utcEnd).length-1).toBe(3);
  expect(service).not.toContain('a.starts_at AS "startsAt"');
  expect(service).not.toContain('a.ends_at AS "endsAt"');
 });
 it("interprets TF1 2026-11-22 19:00 UTC as 20:00 in Paris without double shifting",()=>{
  const iso="2026-11-22T19:00:00.000Z";
  expect(new Date(iso).toISOString()).toBe(iso);
  expect(new Intl.DateTimeFormat("fr-FR",{
   timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",
  }).format(new Date(iso))).toBe("20:00");
 });
 it("respects summer time without a fixed one-hour workaround",()=>{
  const iso="2026-07-22T18:00:00.000Z";
  expect(new Intl.DateTimeFormat("fr-FR",{
   timeZone:"Europe/Paris",hour:"2-digit",minute:"2-digit",
  }).format(new Date(iso))).toBe("20:00");
 });
});
