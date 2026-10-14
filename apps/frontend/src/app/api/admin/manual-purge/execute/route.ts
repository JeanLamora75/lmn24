import { NextResponse } from "next/server";
import { proxyAdminBackend } from "@/lib/admin-backend";

export async function POST(request: Request): Promise<Response> {
  // Prevent cross-origin form and cookie replay at the public web boundary.
  // The backend additionally requires a short-lived, user-bound one-time token.
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (!origin || origin !== new URL(request.url).origin ||
      site && site !== "same-origin" && site !== "none") {
    return NextResponse.json({ message: "Origine de la requête non autorisée." },
      { status: 403 });
  }
  return proxyAdminBackend(request, "/admin/manual-purge/execute", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
  });
}
