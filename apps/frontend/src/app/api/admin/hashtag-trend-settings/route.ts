import { proxyAdminBackend } from "@/lib/admin-backend";

export async function GET(request: Request): Promise<Response> {
  return proxyAdminBackend(request, "/admin/hashtag-trend-settings");
}
export async function PUT(request: Request): Promise<Response> {
  return proxyAdminBackend(request, "/admin/hashtag-trend-settings", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: await request.text(),
  });
}
