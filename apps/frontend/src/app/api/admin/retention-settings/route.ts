import { proxyAdminBackend } from "@/lib/admin-backend";

export async function GET(request: Request): Promise<Response> {
  return proxyAdminBackend(request, "/admin/retention-settings");
}

export async function PATCH(request: Request): Promise<Response> {
  return proxyAdminBackend(request, "/admin/retention-settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: await request.text(),
  });
}
