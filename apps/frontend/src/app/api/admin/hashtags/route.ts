import { proxyAdminBackend } from "@/lib/admin-backend";

export async function GET(request: Request): Promise<Response> {
  return proxyAdminBackend(request, "/admin/hashtags" + new URL(request.url).search);
}
export async function POST(request: Request): Promise<Response> {
  return proxyAdminBackend(request, "/admin/hashtags", {
    method: "POST", headers: { "content-type": "application/json" },
    body: await request.text(),
  });
}
