import { afterEach, describe, expect, it, vi } from "vitest";
import { horoscopeImportExecutor, HoroscopeFileMissingError } from "./horoscope-scheduler-adapter.js";
import { GlobalParserBusyError } from "./global-parser-lock.js";

const secret = "test-only-internal-secret-with-more-than-32-characters";
const url = "http://127.0.0.1:3001";

afterEach(() => { vi.unstubAllGlobals(); });

describe("Horoscope scheduler adapter", () => {
  it("propagates a busy global lease to the dispatcher", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 409 })));
    await expect(horoscopeImportExecutor(url, secret)()).rejects.toBeInstanceOf(GlobalParserBusyError);
  });

  it("treats HTTP 404 as a missing daily file", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    await expect(horoscopeImportExecutor(url, secret)()).rejects.toBeInstanceOf(HoroscopeFileMissingError);
  });

  it("returns SUCCESS only for an acknowledged backend import", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "SUCCESS" })));
    await expect(horoscopeImportExecutor(url, secret)()).resolves.toEqual({ status: "SUCCESS" });
  });

  it("rejects backend failures instead of marking the job successful", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    await expect(horoscopeImportExecutor(url, secret)()).rejects.toThrow("HTTP 503");
  });

  it("requires a sufficiently long shared secret", () => {
    expect(() => horoscopeImportExecutor(url, "short")).toThrow("SCHEDULER_INTERNAL_SECRET");
  });

  it("refuses remote backend URLs", () => {
    expect(() => horoscopeImportExecutor("http://example.com:3001", secret)).toThrow("loopback");
  });
});
