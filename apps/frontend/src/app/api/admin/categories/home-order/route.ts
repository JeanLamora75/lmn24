import { proxyAdminBackend } from "@/lib/admin-backend";

export async function PUT(request: Request): Promise<Response> {
  return proxyAdminBackend(request, "/admin/categories/home-order", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: await request.text(),
  });
}
