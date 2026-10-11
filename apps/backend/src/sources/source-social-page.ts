import type { Page } from "playwright";

import type { SocialCandidate } from "./source-social-links";

export type SocialPageEvidence = {
  candidates: SocialCandidate[];
  internalPages: string[];
};

/**
 * Inspect only DOM links and JSON-LD sameAs. No social site is visited.
 * Limits avoid excessive work on large, untrusted news homepages.
 */
export async function inspectSocialPage(page: Page): Promise<SocialPageEvidence> {
  return page.evaluate(() => {
    type Candidate = { url: string; origin: "sameAs" | "header" | "footer" | "relMe" | "body" | "secondary" };
    const candidates: Candidate[] = [];
    const internalPages: string[] = [];
    const pageOrigin = window.location.origin;
    const social = /(?:facebook\.com|twitter\.com|x\.com|instagram\.com|youtube\.com)/i;
    const about = /(?:about|contact|follow|social|suivez|reseaux|réseaux|uber-uns|ueber-uns|kontakt|over-ons|chi-siamo|quienes-somos)/i;

    for (const link of Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).slice(0, 650)) {
      const href = link.href;
      if (!href || href.length > 2048) continue;
      if (social.test(href)) {
        const location =
          link.closest("header") ? "header" :
          link.closest("footer") ? "footer" :
          link.rel.split(/\s+/).includes("me") ? "relMe" : "body";
        candidates.push({ url: href, origin: location });
      } else if (internalPages.length < 10) {
        try {
          const url = new URL(href);
          if (
            url.origin === pageOrigin &&
            /^https?:$/.test(url.protocol) &&
            about.test((url.pathname + " " + (link.textContent || "")).slice(0, 250)) &&
            !internalPages.includes(url.toString())
          ) internalPages.push(url.toString());
        } catch {
          // Ignore malformed anchor hrefs.
        }
      }
    }

    function takeSameAs(value: unknown, depth = 0): void {
      if (depth > 5 || candidates.length > 650 || !value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        for (const item of value.slice(0, 30)) takeSameAs(item, depth + 1);
        return;
      }
      const record = value as Record<string, unknown>;
      const sameAs = record.sameAs;
      if (typeof sameAs === "string" && sameAs.length <= 2048) {
        candidates.push({ url: sameAs, origin: "sameAs" });
      } else if (Array.isArray(sameAs)) {
        for (const item of sameAs.slice(0, 30)) {
          if (typeof item === "string" && item.length <= 2048)
            candidates.push({ url: item, origin: "sameAs" });
        }
      }
      for (const nested of Object.values(record).slice(0, 24)) {
        if (nested && typeof nested === "object") takeSameAs(nested, depth + 1);
      }
    }

    for (const script of Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]')).slice(0, 12)) {
      try {
        if (script.textContent && script.textContent.length <= 65_536) {
          takeSameAs(JSON.parse(script.textContent));
        }
      } catch {
        // Invalid or unrelated JSON-LD is normal.
      }
    }
    return { candidates: candidates.slice(0, 650), internalPages: internalPages.slice(0, 3) };
  });
}
