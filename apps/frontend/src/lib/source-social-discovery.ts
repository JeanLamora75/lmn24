export const SOCIAL_KEYS = ["facebookUrl", "xUrl", "instagramUrl", "youtubeUrl"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];
export type SocialLinkValues = Record<SocialKey, string | null>;
export const SOCIAL_LABELS: Record<SocialKey, string> = {
  facebookUrl: "Facebook", xUrl: "X / Twitter",
  instagramUrl: "Instagram", youtubeUrl: "YouTube",
};

export function mergeSocialDiscovery(
  previous: Readonly<SocialLinkValues>,
  discovered: Readonly<SocialLinkValues>,
): { next: SocialLinkValues; conflicts: Partial<SocialLinkValues>; found: number; added: number } {
  const next = { ...previous };
  const conflicts: Partial<SocialLinkValues> = {};
  let added = 0;
  let found = 0;
  for (const key of SOCIAL_KEYS) {
    const url = discovered[key];
    if (!url) continue;
    found += 1;
    if (!previous[key]?.trim()) {
      next[key] = url;
      added += 1;
    } else if (previous[key] !== url) {
      conflicts[key] = url;
    }
  }
  return { next, conflicts, added, found };
}
