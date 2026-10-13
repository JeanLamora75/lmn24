import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/admin-backend";
type Props = Readonly<{ params: Promise<{ filename: string }> }>;

export async function GET(_request: Request, { params }: Props): Promise<Response> {
  const { filename } = await params;
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.webp$/i.test(filename)) {
    return new Response(null, { status: 404 });
  }
  try {
    const response = await fetch(getBackendUrl() + "/media/hashtags/" + encodeURIComponent(filename), {
      cache: "no-store",
    });
    if (!response.ok) return new Response(null, { status: response.status === 404 ? 404 : 503 });
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        "content-type": "image/webp",
        "cache-control": "public, max-age=86400, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
