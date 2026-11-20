import { describe, expect, it } from "vitest";
import { isPublicTvApiPath, shouldBlockTvApi } from "./tv-public-gate";

describe("SCRUM-113 backend TV public embargo", () => {
  it("blocks every public API TV prefix by default, including nested search", () => {
    for (const path of ["/public/tv", "/public/tv/search?q=2", "/public/tv/countries", "/api/public/tv/channels/2", "/tv/public", "/api/tv/public/programmes/abc"]) {
      expect(isPublicTvApiPath(path), path).toBe(true);
      expect(shouldBlockTvApi(path, {}), path).toBe(true);
    }
  });
  it("cannot be enabled using only a feature flag or release key", () => {
    expect(shouldBlockTvApi("/public/tv/search", { TV_PUBLIC_ENABLED: "true" })).toBe(true);
    expect(shouldBlockTvApi("/public/tv/search", { TV_PUBLIC_RELEASE_APPROVED: "true" })).toBe(true);
  });
  it("leaves admin and existing services unaffected", () => {
    for (const path of ["/admin/tv/channels", "/api/admin/tv/countries", "/public/weather", "/docs", "/health", "/public/tv-old"]) {
      expect(shouldBlockTvApi(path, {}), path).toBe(false);
    }
    expect(shouldBlockTvApi("/public/tv", { TV_PUBLIC_ENABLED: "true", TV_PUBLIC_RELEASE_APPROVED: "true" })).toBe(false);
  });
});
