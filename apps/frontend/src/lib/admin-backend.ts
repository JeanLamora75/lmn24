import { NextResponse } from "next/server";

function getBackendUrl(): string {
  return (
    process.env.BACKEND_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_BACKEND_URL ??
    "http://localhost:3001"
  ).replace(/\/$/, "");
}

export async function proxyAdminBackend(
  request: Request,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  try {
    const response = await fetch(getBackendUrl() + path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    });

    const body = await response.text();

    return new NextResponse(body || null, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Service d’administration indisponible." },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }
}
