import { proxyAdminBackend } from "@/lib/admin-backend";
type Props = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Props) {
  const { id } = await params; return proxyAdminBackend(request, "/admin/videos/" + encodeURIComponent(id));
}
export async function PUT(request: Request, { params }: Props) {
  const { id } = await params; return proxyAdminBackend(request, "/admin/videos/" + encodeURIComponent(id),
    { method: "PUT", headers: { "content-type": "application/json" }, body: await request.text() });
}
