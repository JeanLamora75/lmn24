/**
 * Accept only well-formed HTTP(S) origins (no credentials, paths, queries, or fragments).
 * Both browser Origin and the deployment's public origin use this validation.
 */
function parseHttpOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Protect weather admin mutations against cross-origin requests.
 *
 * Behind a reverse proxy, request.url may have the INTERNAL origin
 * (http://127.0.0.1:3000), while the browser correctly sends the PUBLIC
 * Origin (https://www.lmn24.com). We therefore permit one explicitly
 * configured public origin in addition to the actual request.url origin.
 *
 * Deliberately do not trust Host / X-Forwarded-Host supplied by the client
 * to expand the list of allowed origins.
 */
export function weatherMutationAllowed(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") return false;

  const rawOrigin = request.headers.get("origin");
  if (!rawOrigin) return site === "same-origin";

  const origin = parseHttpOrigin(rawOrigin);
  if (!origin) return false;

  const internalOrigin = new URL(request.url).origin;
  const publicOrigin = parseHttpOrigin(process.env.WEATHER_ADMIN_PUBLIC_ORIGIN);

  return origin === internalOrigin || (publicOrigin !== null && origin === publicOrigin);
}

export function rejectedWeatherMutation(): Response {
  return Response.json({ message: "Origine non autorisée." }, { status: 403 });
}
