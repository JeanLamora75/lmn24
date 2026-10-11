import {
  isValidSourceProfileUrl,
} from "@lmn24/contracts";

export const SOCIAL_FIELDS = [
  "facebookUrl", "xUrl", "instagramUrl", "youtubeUrl",
] as const;
export type SocialField = (typeof SOCIAL_FIELDS)[number];
export type SocialLinks = Record<SocialField, string | null>;
export type SocialCandidate = {
  url: string;
  origin: "sameAs" | "header" | "footer" | "relMe" | "body" | "secondary";
};

export const EMPTY_SOCIAL_LINKS: SocialLinks = {
  facebookUrl: null, xUrl: null, instagramUrl: null, youtubeUrl: null,
};

const priorities: Record<SocialCandidate["origin"], number> = {
  sameAs: 100, header: 90, footer: 85, relMe: 80, body: 50, secondary: 30,
};

const forbiddenPaths = /(?:^|\/)(?:share|sharer|sharing|intent|dialog|plugins|login|signin|signup|hashtag|search|explore|privacy|policy|help|settings|home|watch|embed|shorts|p|reel|reels|stories|story|posts?|photo|photos|video|videos|live|status|statuses|i|compose|widgets?|events?|groups?|marketplace|login\.php|sharer\.php)(?:\/|$)/i;

/** Profile URLs are retained as written, apart from removable URL tracking. */
export function resolveSocialProfile(raw: string): { field: SocialField; url: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const field: SocialField | undefined =
    (host === "facebook.com" || host.endsWith(".facebook.com")) ? "facebookUrl" :
    (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) ? "xUrl" :
    (host === "instagram.com" || host.endsWith(".instagram.com")) ? "instagramUrl" :
    (host === "youtube.com" || host.endsWith(".youtube.com")) ? "youtubeUrl" : undefined;
  if (!field || !isValidSourceProfileUrl(url.toString(), field)) return null;
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/" || forbiddenPaths.test(path)) return null;
  // Avoid article/video links that are not profiles; YouTube only uses known channel shapes.
  if (field === "youtubeUrl" && !/^\/(?:@[^/]+|channel\/[^/]+|user\/[^/]+|c\/[^/]+)(?:\/)?$/i.test(path)) return null;
  if (field === "xUrl" && !/^\/[^/]+\/?$/i.test(path)) return null;
  if (field === "instagramUrl" && !/^\/[^/]+\/?$/i.test(path)) return null;
  if (field === "facebookUrl" && path.split("/").filter(Boolean).length > 2) return null;
  // Remove share/referrer query parameters, preserve the complete verified profile path.
  url.search = "";
  url.hash = "";
  return { field, url: url.toString() };
}

export function findSocialLinks(candidates: readonly SocialCandidate[]): SocialLinks {
  const found: SocialLinks = { ...EMPTY_SOCIAL_LINKS };
  const scores: Record<SocialField, number> = {
    facebookUrl: -1, xUrl: -1, instagramUrl: -1, youtubeUrl: -1,
  };
  for (const candidate of candidates.slice(0, 650)) {
    const profile = resolveSocialProfile(candidate.url);
    if (!profile) continue;
    const score = priorities[candidate.origin];
    if (score > scores[profile.field]) {
      scores[profile.field] = score;
      found[profile.field] = profile.url;
    }
  }
  return found;
}

/** No existing form value may be overwritten without explicit user action. */
export function mergeDiscoveredSocialLinks(
  current: Readonly<SocialLinks>,
  discovered: Readonly<SocialLinks>,
): { merged: SocialLinks; conflicts: SocialLinks; added: number } {
  const merged = { ...current };
  const conflicts = { ...EMPTY_SOCIAL_LINKS };
  let added = 0;
  for (const field of SOCIAL_FIELDS) {
    const found = discovered[field];
    if (!found) continue;
    if (!current[field]?.trim()) {
      merged[field] = found;
      added += 1;
    } else if (current[field] !== found) {
      conflicts[field] = found;
    }
  }
  return { merged, conflicts, added };
}
