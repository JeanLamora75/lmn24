import { proxyAdminBackend } from "@/lib/admin-backend";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const key of ["period", "ids"]) {
    const value = params.get(key);
    if (value !== null) query.set(key, value);
  }
  return proxyAdminBackend(request, "/admin/statistics/hashtags?" + query.toString());
}
