import { proxyAdminBackend } from "@/lib/admin-backend";
export async function GET(request: Request): Promise<Response> {
  return proxyAdminBackend(request, "/admin/scheduler-settings");
}
export async function PATCH(request: Request): Promise<Response> {
  return proxyAdminBackend(request, "/admin/scheduler-settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: await request.text(),
  });
}
