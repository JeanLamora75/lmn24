import { proxyAdminBackend } from "@/lib/admin-backend";
type Props = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Props) {
  const { id } = await params; return proxyAdminBackend(request, "/admin/videos/" + encodeURIComponent(id) + "/publication",
    { method: "PATCH", headers: { "content-type": "application/json" }, body: await request.text() });
}
