import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { removeTeamMember, sendTeamAccessLink, updateTeamMember } from "../actions";

const roleLabel: Record<string, string> = { organization_admin: "Administrador", doctor: "Médico", staff: "Equipe", platform_admin: "Administrador da plataforma" };

export default async function TeamMemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [{ id }, query, context] = await Promise.all([params, searchParams, getAdminContext()]);
  if (!context.organization) notFound();
  const db = await createClient();
  const { data: member } = await db.from("organization_memberships").select("id,user_id,role,status,created_at").eq("id", id).eq("organization_id", context.organization.id).maybeSingle();
  if (!member) notFound();
  const [{ data: profile }, { data: authUser }] = await Promise.all([db.from("profiles").select("full_name").eq("id", member.user_id).maybeSingle(), createAdminClient().auth.admin.getUserById(member.user_id)]);
  const name = profile?.full_name || "Usuário sem nome";
  const email = authUser.user?.email || null;
  const manageable = can(context.role, "team:manage");
  const isCurrentUser = member.user_id === context.user.id;
  const editableRole = member.role === "platform_admin" ? "organization_admin" : member.role;
  return <main className="admin-content crud-detail"><PageHeader eyebrow="EQUIPE" title={name} description={`${roleLabel[member.role] || member.role} · ${email || "E-mail indisponível"}`} />
    {query.saved ? <p className="success-message">Acesso atualizado.</p> : null}{query.error ? <p className="form-error">Não foi possível concluir a operação.</p> : null}
    <section className="panel"><h2>Perfil e permissões</h2>{manageable ? <form action={updateTeamMember} className="settings-form"><input type="hidden" name="membership_id" value={member.id} /><label>Nome<input name="full_name" defaultValue={name} required /></label><label>Papel<select name="role" defaultValue={editableRole} disabled={isCurrentUser}><option value="organization_admin">Administrador</option><option value="doctor">Médico</option><option value="staff">Equipe</option></select>{isCurrentUser ? <input type="hidden" name="role" value={editableRole} /> : null}</label><label>Status<select name="status" defaultValue={member.status === "invited" ? "inactive" : member.status} disabled={isCurrentUser}><option value="active">Ativo</option><option value="inactive">Inativo</option></select>{isCurrentUser ? <input type="hidden" name="status" value={member.status} /> : null}</label><button>Salvar alterações</button></form> : <p className="muted-copy">Você possui acesso somente para consulta.</p>}</section>
    {manageable && email ? <section className="panel crud-status"><div><strong>Link de acesso</strong><p className="muted-copy">Envie um novo link seguro para definição ou recuperação da senha.</p></div><form action={sendTeamAccessLink}><input type="hidden" name="membership_id" value={member.id} /><button className="secondary-action">Enviar novo link</button></form></section> : null}
    {manageable && !isCurrentUser ? <section className="panel crud-danger"><div><strong>Remover da organização</strong><p className="muted-copy">A conta global será preservada, mas perderá o acesso a esta organização.</p></div><form action={removeTeamMember}><input type="hidden" name="membership_id" value={member.id} /><button className="danger-action">Remover acesso</button></form></section> : null}
  </main>;
}
