import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/admin-backend";

type Props = Readonly<{ params: Promise<{ slug: string }> }>;

export async function GET(request: Request, { params }: Props): Promise<Response> {
  const { slug } = await params;
  if (slug.length > 255 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ message: "Hashtag invalide." }, { status: 400 });
  }
  const input = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const key of ["cursor", "limit"]) {
    const value = input.get(key);
    if (value !== null) query.set(key, value);
  }
  try {
    const url = getBackendUrl() + "/public/hashtags/" + encodeURIComponent(slug)
      + "/articles?" + query.toString();
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10000) });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ message: "Service public indisponible." }, {
      status: 503, headers: { "cache-control": "no-store" },
    });
  }
}
