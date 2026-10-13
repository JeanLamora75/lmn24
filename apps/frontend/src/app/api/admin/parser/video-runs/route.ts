import { proxyAdminBackend } from "@/lib/admin-backend";

export async function POST(request: Request): Promise<Response> {
  return proxyAdminBackend(request, "/admin/parser/video-runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
  });
}
