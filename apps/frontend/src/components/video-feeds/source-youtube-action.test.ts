import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sources = readFileSync(new URL("../../app/admin/(protected)/sources/SourcesTable.tsx", import.meta.url), "utf8");
const form = readFileSync(new URL("./VideoFeedsAdmin.tsx", import.meta.url), "utf8");
const creation = readFileSync(new URL("../../app/admin/(protected)/video-feeds/new/page.tsx", import.meta.url), "utf8");
describe("SCRUM-39 YouTube creation from a source", () => {
  it("adds desktop and mobile YouTube actions with the source ID", () => {
    expect((sources.match(/Ajouter un flux vidéo YouTube/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(sources).toContain('/admin/video-feeds/new?sourceId=');
    expect(sources.indexOf('href={newFeedForSourceHref(source.id)}')).toBeLessThan(sources.indexOf('src="/bootstrap-icons/youtube.svg"'));
    expect(sources.indexOf('src="/bootstrap-icons/youtube.svg"')).toBeLessThan(sources.indexOf('title="Modifier la source"'));
  });
  it("accepts the selected source and defaults to news only when creating", () => {
    expect(creation).toContain("searchParams");
    expect(creation).toContain("initialSourceId={validSourceId}");
    expect(form).toContain("useState(initialSourceId)");
    expect(form).toContain('["actualite","actualites","news","actuality"]');
    expect(form).toContain("if(item){setSourceId(item.sourceId)");
  });
});
