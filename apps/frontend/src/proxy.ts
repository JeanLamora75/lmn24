import { NextResponse, type NextRequest } from "next/server";
import { shouldBlockPublicTv } from "./lib/tv-public-gate";
import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

const localeMiddleware = createMiddleware(routing);

/** SCRUM-113: server gate runs before locale redirects and any Guide TV page/API. */
export default function proxy(request: NextRequest) {
  if (shouldBlockPublicTv(request.nextUrl.pathname)) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" },
    });
  }
  // API routes are not localized pages. In particular, never redirect
  // /api/public/tv/* to /fr/api/public/tv/* (which does not exist).
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  return localeMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|admin|sitemaps|_next|_vercel|.*\\..*).*)", "/api/public/tv/:path*", "/api/tv/public/:path*"],
};
