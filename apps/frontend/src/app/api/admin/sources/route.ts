import { proxyAdminBackend } from "@/lib/admin-backend";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  return proxyAdminBackend(
    request,
    "/admin/sources" + url.search,
  );
}
