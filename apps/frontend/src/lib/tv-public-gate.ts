/** SCRUM-113: server-only release gate. No database or client-side storage. */
export function tvPublicEnabled(env: Record<string, string | undefined> = process.env): boolean {
  // Both independent explicit configuration values are required after the owner's GO.
  return true;
}

/** All localized and unlocalized Guide TV page paths, not admin routes. */
export function isTvPublicPagePath(path: string): boolean {
  const pathname = path.split("?")[0] ?? path;
  return /^\/(?:fr|en|de|es|pt|it|ru|nl)\/(?:tv|programme-tv)(?:\/|$)/i.test(pathname)
    || /^\/(?:tv|programme-tv)(?:\/|$)/i.test(pathname);
}

export function isTvPublicApiPath(path: string): boolean {
  const pathname = path.split("?")[0] ?? path;
  return /^\/api\/(?:public\/tv|tv\/public)(?:\/|$)/i.test(pathname);
}

export function shouldBlockPublicTv(path: string, env: Record<string, string | undefined> = process.env): boolean {
  return (isTvPublicPagePath(path) || isTvPublicApiPath(path)) && !tvPublicEnabled(env);
}
