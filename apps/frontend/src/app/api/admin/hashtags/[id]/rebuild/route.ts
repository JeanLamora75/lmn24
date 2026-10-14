import { proxyAdminBackend } from "@/lib/admin-backend";
type Props = Readonly<{ params: Promise<{ id: string }> }>;

export async function POST(request: Request, { params }: Props): Promise<Response> {
  const { id } = await params;
  return proxyAdminBackend(request, "/admin/hashtags/" + encodeURIComponent(id) + "/rebuild", {
    method: "POST",
  });
}
export async function GET(request: Request, { params }: Props): Promise<Response> {
  const { id } = await params;
  return proxyAdminBackend(request, "/admin/hashtags/" + encodeURIComponent(id) + "/rebuild");
}
