import { proxyAdminBackend } from "@/lib/admin-backend";
type Props = Readonly<{ params: Promise<{ id: string }> }>;

export async function POST(request: Request, { params }: Props): Promise<Response> {
  const { id } = await params;
  return proxyAdminBackend(request, "/admin/hashtags/" + encodeURIComponent(id) + "/image", {
    method: "POST",
    headers: { "content-type": request.headers.get("content-type") ?? "application/octet-stream" },
    body: await request.arrayBuffer(),
  });
}

export async function DELETE(request: Request, { params }: Props): Promise<Response> {
  const { id } = await params;
  return proxyAdminBackend(request, "/admin/hashtags/" + encodeURIComponent(id) + "/image", {
    method: "DELETE",
  });
}
