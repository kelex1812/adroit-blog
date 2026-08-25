import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin";
import { AdminShell } from "@/components/Admin/AdminShell";

/**
 * /admin layout — server-side role guard (US-016). Non-admins get a 404 (the
 * shell is never even rendered). This is the FIRST gate; every API route also
 * checks isAdmin (defense-in-depth — hiding the nav is never the only guard).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdminPage();
  if (!admin) notFound();

  return <AdminShell>{children}</AdminShell>;
}
