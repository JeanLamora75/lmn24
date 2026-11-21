import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getAdminSession } from "@/lib/admin-auth";
import { AdminShell } from "./AdminShell";

type Props = Readonly<{
  children: ReactNode;
}>;

export default async function ProtectedAdminLayout({ children }: Props) {
  const session = await getAdminSession();

  if (!session) {
    redirect("/admin/login");
  }

  return <AdminShell tvAdmin={session.role === "ADMIN"}>{children}</AdminShell>;
}
