import { proxyAdminBackend } from "@/lib/admin-backend";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);

  return proxyAdminBackend(
    request,
    "/admin/feeds" + url.search,
  );
}

export async function POST(request: Request): Promise<Response> {
  return proxyAdminBackend(request, "/admin/feeds", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: await request.text(),
  });
}
