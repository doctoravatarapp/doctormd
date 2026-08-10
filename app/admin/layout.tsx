import { getAdminContext } from "@/lib/auth/context";
import { AdminShell } from "@/components/admin/admin-shell";
import { createClient } from "@/lib/supabase/server";
import "./admin.css";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const context = await getAdminContext();
  const supabase = await createClient();
  const [{count:redCount},{count:semanticCount}]=context.organization?await Promise.all([supabase.from("red_flag_events").select("id",{count:"exact",head:true}).eq("organization_id",context.organization.id).in("status",["new","acknowledged"]),supabase.from("semantic_review_events").select("id",{count:"exact",head:true}).eq("organization_id",context.organization.id).in("status",["new","acknowledged"])]):[{count:0},{count:0}];const alertCount=(redCount??0)+(semanticCount??0);
  const {data:profile}=await supabase.from("profiles").select("full_name").eq("id",context.user.id).maybeSingle();
  return (
    <AdminShell organizationName={context.organization?.name ?? "APolloMD"} email={context.user.email} userName={profile?.full_name || context.user.email?.split("@")[0] || "Usuário"} role={context.role === "organization_admin" ? "Administrador" : context.role === "doctor" ? "Médico" : context.role === "staff" ? "Equipe" : "Plataforma"} alertCount={alertCount}>{children}</AdminShell>
  );
}
