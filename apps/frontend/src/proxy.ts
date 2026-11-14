import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";
import { publicLocaleMatcher } from "./proxy-matcher";

export default createMiddleware(routing);

export const config = {
  matcher: publicLocaleMatcher,
};
