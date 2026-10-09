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
    "/admin/feeds/" + encodeURIComponent(id),
  );
}

export async function PUT(
  request: Request,
  { params }: Props,
): Promise<Response> {
  const { id } = await params;

  return proxyAdminBackend(
    request,
    "/admin/feeds/" + encodeURIComponent(id),
    {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: await request.text(),
    },
  );
}

export async function DELETE(
  request: Request,
  { params }: Props,
): Promise<Response> {
  const { id } = await params;

  return proxyAdminBackend(
    request,
    "/admin/feeds/" + encodeURIComponent(id),
    {
      method: "DELETE",
    },
  );
}
