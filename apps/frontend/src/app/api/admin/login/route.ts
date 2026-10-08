import { NextResponse } from "next/server";

function getBackendUrl(): string {
  return (
    process.env.BACKEND_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

export async function POST(request: Request): Promise<Response> {
  try {
    const response = await fetch(getBackendUrl() + "/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: await request.text(),
      cache: "no-store",
    });

    const body = await response.text();
    const outgoing = new NextResponse(body || null, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });

    const setCookie = response.headers.get("set-cookie");

    if (setCookie) {
      outgoing.headers.set("set-cookie", setCookie);
    }

    return outgoing;
  } catch {
    return NextResponse.json(
      { message: "Service d’authentification indisponible." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
