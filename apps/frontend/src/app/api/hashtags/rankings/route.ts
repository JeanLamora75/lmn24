import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/admin-backend";

export async function GET(request: Request): Promise<Response> {
  try {
    const query = new URL(request.url).search;
    const response = await fetch(getBackendUrl() + "/hashtags/rankings" + query, {
      cache: "no-store",
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ message: "Classement temporairement indisponible." }, {
      status: 503, headers: { "cache-control": "no-store" },
    });
  }
}
