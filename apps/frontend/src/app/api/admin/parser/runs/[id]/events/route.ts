import { getBackendUrl } from "@/lib/admin-backend";

type Props = Readonly<{
  params: Promise<{ id: string }>;
}>;

export async function GET(
  request: Request,
  { params }: Props,
): Promise<Response> {
  const { id } = await params;

  try {
    const upstream = await fetch(
      getBackendUrl() +
        "/admin/parser/runs/" +
        encodeURIComponent(id) +
        "/events",
      {
        headers: {
          cookie: request.headers.get("cookie") ?? "",
        },
        cache: "no-store",
      },
    );

    if (!upstream.ok || !upstream.body) {
      return new Response(await upstream.text(), {
        status: upstream.status,
        headers: {
          "content-type":
            upstream.headers.get("content-type") ??
            "application/json",
          "cache-control": "no-store",
        },
      });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-store",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  } catch {
    return Response.json(
      { message: "Service du parser indisponible." },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
        },
      },
    );
  }
}
