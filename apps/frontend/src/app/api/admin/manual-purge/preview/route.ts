import { proxyAdminBackend } from "@/lib/admin-backend";

export async function GET(request: Request): Promise<Response> {
  const source = new URL(request.url).searchParams;
  const q = new URLSearchParams();
  for (const key of ["table", "mode"]) {
    const value = source.get(key);
    if (value !== null) q.set(key, value);
  }
  return proxyAdminBackend(request, "/admin/manual-purge/preview?" + q.toString());
}
