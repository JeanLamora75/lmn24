import { proxyAdminBackend } from "@/lib/admin-backend";
export async function GET(request: Request) {
  return proxyAdminBackend(request, "/admin/videos/form-options");
}
