import { getAdminContext } from "@/lib/auth/context";
import { Sidebar } from "@/components/admin/sidebar";
import { createClient } from "@/lib/supabase/server";
import "./admin.css";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getAdminContext();
  const supabase = await createClient();
  const { count: alertCount } = context.organization ? await supabase.from("red_flag_events").select("id", { count: "exact", head: true }).eq("organization_id", context.organization.id).in("status", ["new", "acknowledged"]) : { count: 0 };
  return (
    <div className="admin-shell">
      <Sidebar organizationName={context.organization?.name ?? "APolloMD"} email={context.user.email} alertCount={alertCount ?? 0} />
      <div className="admin-main">
        <div className="mobile-admin-bar"><strong>APolloMD</strong><span>{context.organization?.name ?? "Plataforma"}</span></div>
        {children}
      </div>
    </div>
  );
}
