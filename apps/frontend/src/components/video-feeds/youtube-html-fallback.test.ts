import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const form = readFileSync(new URL("./VideoFeedsAdmin.tsx", import.meta.url), "utf8");

describe("SCRUM-39 fallback for blocked YouTube channel pages", () => {
  it("offers copying an App Link tag from Chrome without overwriting the ID field before success", () => {
    expect(form).toContain("La recherche échoue ? Coller une balise HTML YouTube");
    expect(form).toContain("al:ios:url");
    expect(form).toContain("al:android:url");
    expect(form).toContain("Ctrl+U");
    expect(form).toContain("value={metaInput}");
    expect(form).toContain("onClick={()=>void resolveChannel(metaInput)}");
    expect(form).toContain("const query = (queryOverride ?? channelId).trim()");
    expect(form).toContain("setChannelId(payload.channelId)");
    expect(form).toContain("setFeedUrl(payload.feedUrl)");
  });
});
