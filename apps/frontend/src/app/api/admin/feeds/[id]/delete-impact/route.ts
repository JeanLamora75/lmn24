import { proxyAdminBackend } from "@/lib/admin-backend";

type Props = Readonly<{
  params: Promise<{ id: string }>;
}>;

export async function GET(
  request: Request,
  { params }: Props,
): Promise<Response> {
  const { id } = await params;

  return proxyAdminBackend(
    request,
    "/admin/feeds/" +
      encodeURIComponent(id) +
      "/delete-impact",
  );
}
