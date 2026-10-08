import { proxyAdminBackend } from "@/lib/admin-backend";

type Props = Readonly<{
  params: Promise<{ id: string }>;
}>;

export async function PATCH(
  request: Request,
  { params }: Props,
): Promise<Response> {
  const { id } = await params;

  return proxyAdminBackend(
    request,
    "/admin/categories/" + encodeURIComponent(id) + "/status",
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: await request.text(),
    },
  );
}
