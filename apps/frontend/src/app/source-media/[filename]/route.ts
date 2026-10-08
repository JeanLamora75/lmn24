import {
  getBackendUrl,
} from "@/lib/admin-backend";

type Props = Readonly<{
  params: Promise<{ filename: string }>;
}>;

export async function GET(
  _request: Request,
  { params }: Props,
): Promise<Response> {
  const { filename } = await params;

  if (!/^[0-9a-f-]{36}\.(?:png|jpg|jpeg|webp)$/i.test(filename)) {
    return new Response(null, { status: 404 });
  }

  try {
    const response = await fetch(
      getBackendUrl() +
        "/media/sources/" +
        encodeURIComponent(filename),
      {
        cache: "no-store",
      },
    );

    const body = await response.arrayBuffer();

    return new Response(body, {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ??
          "application/octet-stream",
        "cache-control":
          response.headers.get("cache-control") ??
          "public, max-age=86400",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
