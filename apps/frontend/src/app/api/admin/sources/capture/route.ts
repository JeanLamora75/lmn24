import { proxyAdminBackend } from "@/lib/admin-backend";

export async function POST(request: Request): Promise<Response> {
  return proxyAdminBackend(request, "/admin/sources/capture", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: await request.text(),
  });
}
