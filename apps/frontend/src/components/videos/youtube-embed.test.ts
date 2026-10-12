import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { youtubeEmbedUrl } from "./youtube-embed";

const gallery = readFileSync(new URL("./PublicVideos.tsx", import.meta.url), "utf8");
const modal = readFileSync(new URL("./VideoPlayerModal.tsx", import.meta.url), "utf8");
const style = readFileSync(new URL("./public-videos.module.css", import.meta.url), "utf8");

describe("SCRUM-43 — galerie et lecteur YouTube", () => {
  it("n'intègre que des vidéos YouTube valides avec un domaine approuvé", () => {
    expect(youtubeEmbedUrl("https://www.youtube.com/watch?v=abcdefghijk"))
      .toBe("https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1&rel=0");
    expect(youtubeEmbedUrl("https://youtu.be/abcdefghijk"))
      .toBe("https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1&rel=0");
    expect(youtubeEmbedUrl("https://www.youtube.com/shorts/abcdefghijk"))
      .toBe("https://www.youtube-nocookie.com/embed/abcdefghijk?autoplay=1&rel=0");

    for (const url of [
      "http://www.youtube.com/watch?v=abcdefghijk",
      "https://www.youtube.com.evil.test/watch?v=abcdefghijk",
      "https://evil.test/?v=abcdefghijk",
      "javascript:alert('x')",
      "https://www.youtube.com/watch?v=invalid",
      "https://www.youtube.com/watch?v=abcdefghijk123",
      "https://www.youtube.com/channel/UC1234567890123456789012",
    ]) {
      expect(youtubeEmbedUrl(url)).toBeNull();
    }
  });

  it("présente quatre cartes par ligne avec titre et identité de la source", () => {
    expect(style).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
    expect(style).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(style).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(style).toContain("aspect-ratio: 16 / 9");
    expect(gallery).toContain("className={styles.titleOverlay}");
    expect(gallery).toContain("countryIsoCode2={video.source.country.isoCode2}");
    expect(gallery).toContain("{video.source.name}");
    expect(gallery).toContain("onPlay={setSelectedVideo}");
  });

  it("monte un lecteur uniquement à la demande et permet de le fermer", () => {
    expect(gallery).toContain("selectedVideo&&<VideoPlayerModal");
    expect(modal).toContain('role="dialog"');
    expect(modal).toContain('aria-modal="true"');
    expect(modal).toContain('aria-label={t.close}');
    expect(modal).toContain('onClick={onClose}');
    expect(modal).toContain('event.key === "Escape"');
    expect(modal).toContain('previouslyFocused?.focus()');
    expect(modal).toContain('document.body.style.overflow = originalOverflow');
    expect(modal).toContain('src={embedUrl}');
    expect(modal).toContain('referrerPolicy="strict-origin-when-cross-origin"');
  });
});
