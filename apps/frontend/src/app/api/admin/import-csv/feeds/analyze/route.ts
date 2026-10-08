import { proxyAdminBackend } from "@/lib/admin-backend";

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();

  return proxyAdminBackend(request, "/admin/feeds/csv/analyze", {
    method: "POST",
    body: formData,
  });
}
