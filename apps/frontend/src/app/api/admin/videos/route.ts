import { proxyAdminBackend } from "@/lib/admin-backend";
export async function GET(request: Request) {
  return proxyAdminBackend(request, "/admin/videos" + new URL(request.url).search);
}
