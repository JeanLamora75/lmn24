import { describe, expect, it } from "vitest";

import {
  findSocialLinks,
  resolveSocialProfile,
  type SocialCandidate,
} from "./source-social-links";

describe("SCRUM-30 — extraction de profils de médias", () => {
  it("reconnaît quatre comptes avec priorité aux déclarations officielles", () => {
    const links: SocialCandidate[] = [
      { origin: "body", url: "https://www.facebook.com/AutreJournal" },
      { origin: "header", url: "https://www.facebook.com/JournalOfficiel?ref=homepage" },
      { origin: "sameAs", url: "https://x.com/journal" },
      { origin: "footer", url: "https://www.instagram.com/journal/" },
      { origin: "relMe", url: "https://youtube.com/@journal" },
    ];
    expect(findSocialLinks(links)).toEqual({
      facebookUrl: "https://www.facebook.com/JournalOfficiel",
      xUrl: "https://x.com/journal",
      instagramUrl: "https://www.instagram.com/journal/",
      youtubeUrl: "https://youtube.com/@journal",
    });
  });

  it("accepte twitter.com et les chaînes YouTube classiques", () => {
    expect(resolveSocialProfile("https://twitter.com/journal")).toMatchObject({
      field: "xUrl", url: "https://twitter.com/journal",
    });
    expect(resolveSocialProfile("https://youtube.com/channel/UC123")).toMatchObject({
      field: "youtubeUrl",
    });
    expect(resolveSocialProfile("https://www.youtube.com/c/journal")).toMatchObject({
      field: "youtubeUrl",
    });
  });

  it("rejette les liens de partage, les publications et les domaines usurpés", () => {
    for (const url of [
      "https://facebook.com/sharer/sharer.php?u=https://example.com",
      "https://www.facebook.com/dialog/share?href=https://example.com",
      "https://x.com/intent/tweet?url=https://example.org",
      "https://twitter.com/journal/status/1234",
      "https://www.instagram.com/p/C12345/",
      "https://instagram.com/reel/XX123",
      "https://www.youtube.com/watch?v=123",
      "https://youtube.com/shorts/123",
      "https://www.youtube.com/",
      "https://facebook.com.attacker.example/journal",
      "https://evilx.com/account",
      "javascript:alert('hello')",
      "https://user:pass@x.com/journal",
      "https://www.instagram.com.evil.test/journal",
    ]) {
      expect(resolveSocialProfile(url)).toBeNull();
    }
  });

  it("retourne des valeurs nulles lorsqu'aucun lien social fiable n'est présent", () => {
    expect(findSocialLinks([
      { origin: "footer", url: "https://example.org/contact" },
      { origin: "body", url: "https://x.com/intent/tweet" },
    ])).toEqual({
      facebookUrl: null, xUrl: null, instagramUrl: null, youtubeUrl: null,
    });
  });
});
