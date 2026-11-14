/** Public locale routing must never intercept XML sitemap shards. */
export const publicLocaleMatcher = ["/((?!api|admin|sitemaps|_next|_vercel|.*\\..*).*)"];
