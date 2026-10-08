import { proxyAdminBackend } from "@/lib/admin-backend";

export async function POST(request: Request): Promise<Response> {
  return proxyAdminBackend(request, "/admin/sources/image", {
    method: "POST",
    headers: {
      "content-type":
        request.headers.get("content-type") ?? "application/octet-stream",
    },
    body: await request.arrayBuffer(),
  });
}
