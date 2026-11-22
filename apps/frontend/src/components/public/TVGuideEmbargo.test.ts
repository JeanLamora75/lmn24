import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TV_GUIDE_PUBLIC_ENABLED } from "@/lib/tv-guide-release";

const header = readFileSync(new URL("./PublicHeader.tsx", import.meta.url), "utf8");
const footer = readFileSync(new URL("./PublicFooter.tsx", import.meta.url), "utf8");
const homepage = readFileSync(new URL("../../app/[locale]/page.tsx", import.meta.url), "utf8");

describe("LMN24 Guide TV — no public release without owner GO", () => {
  it("keeps the public release gate disabled", () => {
    expect(TV_GUIDE_PUBLIC_ENABLED).toBe(false);
  });

  it("restricts private programme previews to authenticated administrators", () => {
    const preview=readFileSync(new URL("../../app/[locale]/tv-preview/page.tsx",import.meta.url),"utf8");
    const layout=readFileSync(new URL("../../app/[locale]/layout.tsx",import.meta.url),"utf8");
    const client=readFileSync(new URL("../tv/TvGuideHome.tsx",import.meta.url),"utf8");
    expect(preview).toContain('user?.role!=="ADMIN"');
    expect(preview).toContain("notFound()");
    expect(preview).toContain("robots:{index:false,follow:false}");
    expect(layout).toContain('session?.role==="ADMIN"?"preview"');
    expect(client).toContain('/api/admin/tv/catalog/preview/schedule');
    expect(client).toContain("Aperçu privé réservé à l’administration");
  });

  it("never advertises a TV guide to anonymous visitors before release", () => {
    expect(header).toContain('tvNavigation=null');
    expect(header).toContain('...(tvNavigation?');
    expect(header).toContain('tvNavigation==="preview"?"/tv-preview":"/tv"');
    for (const content of [footer, homepage]) {
      expect(content).not.toMatch(/programme[ -]?tv|programmes[ -]?tv|tv[ -]?guide|guide[ -]?tv/i);
    }
  });
});
