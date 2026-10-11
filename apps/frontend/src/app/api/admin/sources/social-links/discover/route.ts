import { NextResponse } from "next/server";

import { proxyAdminBackend } from "@/lib/admin-backend";

export async function POST(request: Request): Promise<Response> {
  const response = await proxyAdminBackend(
    request,
    "/admin/sources/social-links/discover",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: await request.text(),
    },
  );
  if (response.status === 404) {
    return NextResponse.json(
      { message: "La recherche des réseaux sociaux n’est pas disponible. Redémarrez le backend LMN24." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  return response;
}
