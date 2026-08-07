import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

const roleLabels = { platform_admin: "Admin da plataforma", organization_admin: "Admin da organização", doctor: "Médico", staff: "Equipe" } as const;

export default async function TeamPage() {
  const context = await getAdminContext();
  const supabase = await createClient();
  const { data: members } = context.organization ? await supabase.from("organization_memberships").select("id, user_id, role, status, created_at").eq("organization_id", context.organization.id).order("created_at") : { data: [] };
  return <main className="admin-content"><PageHeader eyebrow="EQUIPE" title="Acesso com responsabilidade." description="Administradores, médicos e staff autorizados da organização." /><section className="panel table-panel">{members?.length ? <div className="data-table">{members.map((member) => <div className="data-row" key={member.id}><span className="row-avatar">{member.role === "doctor" ? "D" : "E"}</span><div><strong>{roleLabels[member.role]}</strong><small>ID seguro · {member.user_id.slice(0, 8)}</small></div><span className="status-badge">{member.status}</span></div>)}</div> : <EmptyState icon="◉" title="Equipe ainda não configurada" description="Os perfis autorizados da organização aparecerão aqui." />}</section></main>;
}
