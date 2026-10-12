import { proxyAdminBackend } from "@/lib/admin-backend";
export async function POST(request: Request): Promise<Response> {
  return proxyAdminBackend(request, "/admin/video-feeds/collect", {
    method: "POST", headers: { "content-type": "application/json" }, body: await request.text(),
  });
}
