import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isValidSourceProfileUrl } from "@lmn24/contracts";

import { safeSourceLogo } from "./source-image";

const profile = readFileSync(new URL("./SourceProfile.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("./source.module.css", import.meta.url), "utf8");
const publicPage = readFileSync(new URL("../../app/[locale]/source/[slug]/page.tsx", import.meta.url), "utf8");

describe("SCRUM-32 — identité de source", () => {
  it("conserve le ratio image 1/3 — informations 2/3 et la rangée d'icônes en bas", () => {
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 2fr)");
    expect(css).toContain("margin-top: auto");
    expect(css).toContain("white-space: pre-line");
    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(profile).toContain('<h1 className={styles.name}>{source.name}</h1>');
    expect(profile).toContain("source.description.trim()");
  });

  it("montre les quatre plateformes dans le bon ordre", () => {
    const names = ["facebookUrl", "xUrl", "instagramUrl", "youtubeUrl"];
    const indices = names.map(key => profile.indexOf('field: "' + key + '"'));
    expect(indices.every(index => index >= 0)).toBe(true);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(profile).toContain('target="_blank"');
    expect(profile).toContain('rel="noopener noreferrer"');
    expect(profile).toContain('className={styles.networkDisabled}');
    expect(profile).toContain("isValidSourceProfileUrl(raw, field)");
    expect(css).toContain("filter: grayscale(1)");
  });

  it("rejette des liens de réseaux sociaux malveillants, conserve les vrais profils", () => {
    expect(isValidSourceProfileUrl("https://facebook.com/media", "facebookUrl")).toBe(true);
    expect(isValidSourceProfileUrl("https://facebook.com.evil.test/media", "facebookUrl")).toBe(false);
    expect(isValidSourceProfileUrl("javascript:alert(1)", "instagramUrl")).toBe(false);
    expect(isValidSourceProfileUrl("https://x.com/media", "xUrl")).toBe(true);
    expect(isValidSourceProfileUrl("https://youtube.com/@media", "youtubeUrl")).toBe(true);
  });

  it("gère les médias locaux, externes et les images potentiellement dangereuses", () => {
    expect(safeSourceLogo("/source-media/11111111-1111-4111-8111-111111111111.png"))
      .toBe("/source-media/11111111-1111-4111-8111-111111111111.png");
    expect(safeSourceLogo("https://example.org/logo.png")).toBe("https://example.org/logo.png");
    expect(safeSourceLogo("javascript:alert(1)")).toBeNull();
    expect(safeSourceLogo("/source-media/../../../secret")).toBeNull();
    expect(safeSourceLogo(null)).toBeNull();
  });

  it("réutilise les cartes et la pagination des pages catégories", () => {
    expect(publicPage).toContain("<CategoryArticles");
    expect(publicPage).toContain("paginationPath=");
    expect(publicPage).toContain("<SourceProfile");
    expect(publicPage).toContain("hasLocale(routing.locales, locale)");
    expect(publicPage).toContain('if (page === "not-found") notFound()');
  });
});
