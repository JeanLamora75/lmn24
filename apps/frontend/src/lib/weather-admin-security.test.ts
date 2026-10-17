import { afterEach, describe, expect, it } from "vitest";
import { weatherMutationAllowed } from "./weather-admin-security";

const previousPublicOrigin = process.env.WEATHER_ADMIN_PUBLIC_ORIGIN;

afterEach(() => {
  if (previousPublicOrigin === undefined) {
    delete process.env.WEATHER_ADMIN_PUBLIC_ORIGIN;
  } else {
    process.env.WEATHER_ADMIN_PUBLIC_ORIGIN = previousPublicOrigin;
  }
});

function req(
  origin?: string,
  site?: string,
  url = "https://lmn24.example/api/admin/parser/weather-runs",
  additionalHeaders: Record<string, string> = {},
): Request {
  const headers: Record<string, string> = { ...additionalHeaders };
  if (origin) headers.origin = origin;
  if (site) headers["sec-fetch-site"] = site;
  return new Request(url, { headers });
}

describe("SCRUM-70 — weather mutation origin", () => {
  it("accepts normal same-origin browser writes", () => {
    delete process.env.WEATHER_ADMIN_PUBLIC_ORIGIN;
    expect(weatherMutationAllowed(req("https://lmn24.example", "same-origin"))).toBe(true);
    expect(weatherMutationAllowed(req(undefined, "same-origin"))).toBe(true);
  });

  it("accepts the configured public origin behind an internal HTTP reverse proxy", () => {
    process.env.WEATHER_ADMIN_PUBLIC_ORIGIN = "https://www.lmn24.com";
    const request = req(
      "https://www.lmn24.com",
      "same-origin",
      "http://127.0.0.1:3000/api/admin/parser/weather-runs",
    );
    expect(weatherMutationAllowed(request)).toBe(true);
  });

  it("fails closed for proxied requests when public origin is not configured", () => {
    delete process.env.WEATHER_ADMIN_PUBLIC_ORIGIN;
    const request = req(
      "https://www.lmn24.com",
      "same-origin",
      "http://127.0.0.1:3000/api/admin/parser/weather-runs",
    );
    expect(weatherMutationAllowed(request)).toBe(false);
  });

  it("rejects unrelated, malformed, same-site, and cross-site origins", () => {
    process.env.WEATHER_ADMIN_PUBLIC_ORIGIN = "https://www.lmn24.com";
    const proxiedUrl = "http://127.0.0.1:3000/api/admin/parser/weather-runs";
    expect(weatherMutationAllowed(req("https://other.example", "same-origin", proxiedUrl))).toBe(false);
    expect(weatherMutationAllowed(req("https://www.lmn24.com", "cross-site", proxiedUrl))).toBe(false);
    expect(weatherMutationAllowed(req("https://www.lmn24.com", "same-site", proxiedUrl))).toBe(false);
    expect(weatherMutationAllowed(req("https://www.lmn24.com/path", "same-origin", proxiedUrl))).toBe(false);
    expect(weatherMutationAllowed(req("not a url", "same-origin", proxiedUrl))).toBe(false);
    expect(weatherMutationAllowed(req(undefined, undefined, proxiedUrl))).toBe(false);
  });

  it("rejects spoofed proxy host headers and an invalid configured origin", () => {
    process.env.WEATHER_ADMIN_PUBLIC_ORIGIN = "https://www.lmn24.com/not-an-origin";
    const request = req(
      "https://other.example",
      "same-origin",
      "http://127.0.0.1:3000/api/admin/parser/weather-runs",
      { host: "other.example", "x-forwarded-host": "other.example" },
    );
    expect(weatherMutationAllowed(request)).toBe(false);
  });
});
