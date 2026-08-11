import { EmptyState } from "@/components/admin/empty-state";
import { FormDrawer } from "@/components/admin/form-drawer";
import { PageHeader } from "@/components/admin/page-header";
import { TeamMemberDrawer } from "@/components/admin/team-member-drawer";
import { getAdminContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { inviteTeamMember } from "./actions";

const roleLabels = { platform_admin: "Admin da plataforma", organization_admin: "Admin da organização", doctor: "Médico", staff: "Equipe" } as const;
const feedback = { invited: "Convite enviado. O acesso será ativado após a definição da senha.", added: "Usuário existente adicionado à organização.", updated: "Acesso atualizado.", removed: "Acesso removido da organização." } as const;
const errors = { access: "Você não tem permissão para gerenciar acessos.", validation: "Revise os dados informados.", invite: "Não foi possível enviar o convite.", save: "Não foi possível salvar a alteração.", self: "Você não pode remover ou reduzir o próprio acesso.", last_admin: "A organização precisa manter pelo menos um administrador ativo.", not_found: "O acesso selecionado não existe mais." } as const;

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ saved?: keyof typeof feedback; error?: keyof typeof errors }> }) {
  const params = await searchParams;
  const context = await getAdminContext();
  const supabase = await createClient();
  const { data: members } = context.organization ? await supabase.from("organization_memberships").select("id, user_id, role, status, created_at").eq("organization_id", context.organization.id).order("created_at") : { data: [] };
  const userIds = members?.map((member) => member.user_id) ?? [];
  const { data: profiles } = userIds.length ? await supabase.from("profiles").select("id,full_name").in("id", userIds) : { data: [] };
  const names = new Map(profiles?.map((profile) => [profile.id, profile.full_name]) ?? []);
  const authAdmin = createAdminClient();
  const authUsers = await Promise.all(userIds.map(async (id) => { const { data } = await authAdmin.auth.admin.getUserById(id); return [id, data.user?.email ?? null] as const; }));
  const emails = new Map(authUsers);
  const manageable = can(context.role, "team:manage");
  return <main className="admin-content"><PageHeader eyebrow="EQUIPE" title="Acesso com responsabilidade." description="Administradores, médicos e staff autorizados da organização." /><div className="page-feedback">{params.saved ? <p className="success-message">{feedback[params.saved]}</p> : null}{params.error ? <p className="form-error">{errors[params.error]}</p> : null}</div><section className="panel table-panel">{members?.length ? <div className="data-table">{members.map((member) => { const name = names.get(member.user_id) || "Usuário sem nome"; const memberRole = member.role === "platform_admin" ? "organization_admin" : member.role; return <article className="team-row" key={member.id}><span className="row-avatar">{member.role === "doctor" ? "D" : "E"}</span><div className="doctor-summary"><strong>{name}{member.user_id === context.user.id ? " · Você" : ""}</strong><small>{emails.get(member.user_id) || `ID seguro · ${member.user_id.slice(0, 8)}`}</small></div><span className="status-badge">{member.status}</span><span className="team-role">{roleLabels[member.role]}</span>{manageable ? <TeamMemberDrawer member={{ id: member.id, name, role: memberRole, status: member.status, isCurrentUser: member.user_id === context.user.id }} /> : null}</article>; })}</div> : <EmptyState icon="◉" title="Equipe ainda não configurada" description="Os perfis autorizados da organização aparecerão aqui." />}</section>{manageable ? <FormDrawer label="Adicionar usuário" title="Adicionar acesso" description="Convide um administrador ou integrante da equipe por e-mail."><form action={inviteTeamMember} className="drawer-form"><label>Nome completo<input name="full_name" minLength={2} required /></label><label>E-mail<input name="email" type="email" autoComplete="email" required /></label><label>Papel<select name="role" defaultValue="organization_admin"><option value="organization_admin">Administrador da organização</option><option value="doctor">Médico</option><option value="staff">Equipe</option></select></label><button>Enviar convite</button></form></FormDrawer> : null}</main>;
}
