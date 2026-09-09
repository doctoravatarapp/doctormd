import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { configureDoctorAccess, sendDoctorAccessLink, toggleDoctorStatus, updateDoctor } from "../actions";

export default async function DoctorDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [{ id }, query, context] = await Promise.all([params, searchParams, getAdminContext()]);
  if (!context.organization) notFound();
  const db = await createClient();
  const { data: doctor } = await db.from("doctors").select("id,user_id,email,display_name,specialty,professional_registration,status").eq("id", id).eq("organization_id", context.organization.id).maybeSingle();
  if (!doctor) notFound();
  const { data: episodes } = await db.from("care_episodes").select("id,procedure_name,status").eq("doctor_id", id).eq("organization_id", context.organization.id).order("created_at", { ascending: false }).limit(8);
  const manageable = can(context.role, "doctors:manage");
  const { data: membership } = manageable && doctor.user_id ? await db.from("organization_memberships").select("status").eq("organization_id", context.organization.id).eq("user_id", doctor.user_id).maybeSingle() : { data: null };
  const authUser = manageable && doctor.user_id ? (await createAdminClient().auth.admin.getUserById(doctor.user_id)).data.user : null;
  const accessEmail = doctor.email || authUser?.email || null;
  const accessStatus = doctor.user_id && membership?.status === "active" && authUser?.email_confirmed_at ? "Ativo" : doctor.user_id ? "Convite pendente" : "Não configurado";
  const savedMessage = query.saved === "invited" ? "Médico cadastrado e convite enviado." : query.saved === "linked" ? "Médico vinculado a um acesso já existente." : query.saved === "access_sent" ? "Novo link de acesso enviado." : query.saved ? "Médico atualizado." : null;
  const errorMessage = query.error === "invite" ? "O cadastro profissional foi salvo, mas o acesso não pôde ser enviado. Confira o e-mail e tente novamente abaixo." : query.error ? "Não foi possível salvar o médico." : null;
  return <main className="admin-content crud-detail"><PageHeader eyebrow="MÉDICO" title={doctor.display_name} description={`${doctor.specialty || "Especialidade não informada"} · ${doctor.status === "active" ? "Ativo" : "Inativo"}`} />
    {savedMessage ? <p className="success-message">{savedMessage}</p> : null}{errorMessage ? <p className="form-error">{errorMessage}</p> : null}
    <section className="panel"><h2>Dados profissionais</h2>{manageable ? <form action={updateDoctor} className="settings-form"><input type="hidden" name="id" value={doctor.id} /><label>Nome de exibição<input name="display_name" defaultValue={doctor.display_name} required /></label><label>Especialidade<input name="specialty" defaultValue={doctor.specialty ?? ""} /></label><label>Registro profissional<input name="professional_registration" defaultValue={doctor.professional_registration ?? ""} /></label><button>Salvar alterações</button></form> : <p className="muted-copy">Você possui acesso somente para consulta.</p>}</section>
    {manageable ? <section className="panel doctor-access-card"><div className="panel-title"><div><p className="eyebrow">ACESSO AO SISTEMA</p><h2>{accessStatus}</h2></div><span className="status-badge">{accessStatus}</span></div><p className="muted-copy">{accessEmail || "Informe o e-mail profissional para criar e vincular o acesso deste médico."}</p>{doctor.user_id && accessEmail ? <form action={sendDoctorAccessLink} className="settings-form"><input type="hidden" name="doctor_id" value={doctor.id} /><button className="secondary-action">Reenviar link de acesso</button></form> : <form action={configureDoctorAccess} className="settings-form"><input type="hidden" name="doctor_id" value={doctor.id} /><label>E-mail de acesso<input name="email" type="email" defaultValue={accessEmail || ""} autoComplete="email" required /></label><button>Configurar e enviar acesso</button></form>}</section> : null}
    {manageable ? <section className="panel crud-status"><div><strong>Status do médico</strong><p className="muted-copy">Médicos inativos permanecem no histórico, mas não recebem novos acompanhamentos.</p></div><form action={toggleDoctorStatus}><input type="hidden" name="id" value={doctor.id} /><input type="hidden" name="status" value={doctor.status} /><button className="secondary-action">{doctor.status === "active" ? "Inativar médico" : "Ativar médico"}</button></form></section> : null}
    <section className="panel"><h2>Acompanhamentos recentes</h2>{episodes?.length ? episodes.map((episode) => <Link className="compact-row" href={`/admin/episodes/${episode.id}`} key={episode.id}><strong>{episode.procedure_name}</strong><span>{episode.status} →</span></Link>) : <p className="muted-copy">Nenhum acompanhamento vinculado.</p>}</section>
  </main>;
}
