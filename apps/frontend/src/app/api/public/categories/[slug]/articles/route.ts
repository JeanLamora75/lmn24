import { NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/admin-backend";

type Props = Readonly<{ params: Promise<{ slug: string }> }>;

export async function GET(request: Request, { params }: Props): Promise<Response> {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ message: "Catégorie invalide." }, { status: 400 });
  }
  // The proxy exposes only the documented public query parameters.
  const input = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const key of ["locale", "cursor", "limit"]) {
    const value = input.get(key);
    if (value !== null) query.set(key, value);
  }
  try {
    const response = await fetch(
      getBackendUrl() + "/public/categories/" + encodeURIComponent(slug) +
        "/articles?" + query.toString(),
      { cache: "no-store" },
    );
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Service public indisponible." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
