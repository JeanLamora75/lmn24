import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getAdminSession } from "@/lib/admin-auth";

type Props = Readonly<{
  children: ReactNode;
}>;

export default async function ProtectedAdminLayout({ children }: Props) {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return children;
}
