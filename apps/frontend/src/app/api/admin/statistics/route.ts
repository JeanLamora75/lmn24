import { proxyAdminBackend } from "@/lib/admin-backend";
export async function GET(request: Request): Promise<Response> {
  return proxyAdminBackend(request, "/admin/statistics" + new URL(request.url).search);
}
