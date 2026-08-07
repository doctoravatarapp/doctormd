import { getAdminContext } from "@/lib/auth/context";
import { Sidebar } from "@/components/admin/sidebar";
import "./admin.css";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getAdminContext();
  return (
    <div className="admin-shell">
      <Sidebar organizationName={context.organization?.name ?? "APolloMD"} email={context.user.email} />
      <div className="admin-main">
        <div className="mobile-admin-bar"><strong>APolloMD</strong><span>{context.organization?.name ?? "Plataforma"}</span></div>
        {children}
      </div>
    </div>
  );
}
