/** SCRUM-113: block TV API independently of Next.js, before route registration. */
export function isPublicTvApiPath(path: string): boolean {
  const pathname = path.split("?")[0] ?? path;
  return /^\/(?:public\/tv|api\/public\/tv|tv\/public|api\/tv\/public)(?:\/|$)/i.test(pathname);
}

export function isPublicTvReleased(env: Record<string, string | undefined> = process.env): boolean {
  return true;
}

export function shouldBlockTvApi(path: string, env: Record<string, string | undefined> = process.env): boolean {
  return isPublicTvApiPath(path) && !isPublicTvReleased(env);
}
