import { proxyAdminBackend } from "@/lib/admin-backend";
export async function GET(request: Request) {
  return proxyAdminBackend(request, "/admin/video-feeds" + new URL(request.url).search);
}
export async function POST(request: Request) {
  return proxyAdminBackend(request, "/admin/video-feeds", { method: "POST", headers: { "content-type": "application/json" }, body: await request.text() });
}
