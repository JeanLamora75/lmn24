import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const media=readFileSync(new URL("./HomeArticleMedia.tsx",import.meta.url),"utf8");
const section=readFileSync(new URL("./HomeSection.tsx",import.meta.url),"utf8");
const home=readFileSync(new URL("../../app/[locale]/page.tsx",import.meta.url),"utf8");
const collection=readFileSync(new URL("../category/CategoryArticles.tsx",import.meta.url),"utf8");
const video=readFileSync(new URL("../videos/PublicVideos.tsx",import.meta.url),"utf8");

describe("SCRUM-98 initial rendering and image loading",()=>{
  it("prioritizes a single first article image per initial above-fold listing",()=>{
    expect(home).toContain("aboveFold={index === 0}");
    expect(section).toContain("eagerMedia={aboveFold && index === 0}");
    expect(collection).toContain("eagerMedia={index === 0 && articleIndex === 0}");
    expect(media).toContain('loading={eager ? "eager" : "lazy"}');
    expect(media).toContain('fetchPriority={eager ? "high" : "auto"}');
  });
  it("keeps a defined image aspect ratio and background when a source image fails",()=>{
    expect(media).toContain("width={640}");
    expect(media).toContain("height={360}");
    expect(media).toContain("decoding=\"async\"");
    expect(media).toContain("onError={() => setFailedUrls");
    expect(media).toContain("styles.mediaFallback");
  });
  it("does not eagerly load all remote video thumbnails",()=>{
    expect(video).toContain('loading="lazy"');
    expect(video).toContain('fetchPriority="low"');
    expect(video).toContain('width={480} height={270}');
  });
});
