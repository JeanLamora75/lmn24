export function weatherMutationAllowed(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return site === "same-origin";
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}
export function rejectedWeatherMutation(): Response {
  return Response.json({ message: "Origine non autorisée." }, { status: 403 });
}
