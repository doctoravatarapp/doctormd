import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createEpisode } from "@/app/admin/episodes/actions";

export default async function PatientDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params; const query = await searchParams; const context = await getAdminContext(); if (!context.organization) notFound();
  const supabase = await createClient();
  const { data: patient } = await supabase.from("patients").select("id, full_name, preferred_name, email, phone, birth_date, status, auth_user_id").eq("organization_id", context.organization.id).eq("id", id).maybeSingle();
  if (!patient) notFound();
  const [{ data: episodes }, { data: conversations }, { data: doctors }] = await Promise.all([
    supabase.from("care_episodes").select("id, doctor_id, procedure_name, procedure_date, status").eq("organization_id", context.organization.id).eq("patient_id", id).order("created_at", { ascending: false }),
    supabase.from("conversations").select("id, status, mode, last_message_at").eq("organization_id", context.organization.id).eq("patient_id", id).order("last_message_at", { ascending: false }),
    supabase.from("doctors").select("id, display_name").eq("organization_id", context.organization.id).eq("status", "active").order("display_name"),
  ]);
  const conversationIds = conversations?.map((item) => item.id) ?? [];
  const { count: pendingAlerts } = conversationIds.length ? await supabase.from("red_flag_events").select("id", { count: "exact", head: true }).in("conversation_id", conversationIds).in("status", ["new", "acknowledged"]) : { count: 0 };
  const doctorNames = new Map(doctors?.map((doctor) => [doctor.id, doctor.display_name]));

  return <main className="admin-content"><PageHeader eyebrow="PACIENTE" title={patient.preferred_name || patient.full_name} description={`${patient.full_name} · ${patient.status === "active" ? "Ativo" : "Inativo"}`} />
    {query.error ? <p className="form-error">Não foi possível criar o acompanhamento. Revise os dados.</p> : null}
    <section className="detail-grid"><article className="panel info-card"><h2>Identidade e contato</h2><dl><div><dt>E-mail</dt><dd>{patient.email || "Não informado"}</dd></div><div><dt>Telefone</dt><dd>{patient.phone || "Não informado"}</dd></div><div><dt>Nascimento</dt><dd>{patient.birth_date ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${patient.birth_date}T12:00:00`)) : "Não informado"}</dd></div><div><dt>Acesso do paciente</dt><dd>{patient.auth_user_id ? "Vinculado" : "Preparado para convite futuro"}</dd></div><div><dt>Alertas pendentes</dt><dd>{pendingAlerts ?? 0}</dd></div></dl></article>
      <article className="panel"><h2>Novo acompanhamento</h2>{can(context.role, "episodes:create") && doctors?.length ? <form action={createEpisode} className="stack-form"><input type="hidden" name="patient_id" value={patient.id} /><input name="procedure_name" placeholder="Procedimento *" required /><select name="doctor_id" required defaultValue=""><option value="" disabled>Médico responsável</option>{doctors.map((doctor) => <option value={doctor.id} key={doctor.id}>{doctor.display_name}</option>)}</select><input type="date" name="procedure_date" aria-label="Data do procedimento" /><select name="status" defaultValue="planned"><option value="planned">Planejado</option><option value="preoperative">Pré-operatório</option><option value="postoperative">Pós-operatório</option></select><button>Criar episódio e conversa</button></form> : <p className="muted-copy">Cadastre um médico ativo antes de iniciar o acompanhamento.</p>}</article>
      <article className="panel"><h2>Episódios</h2>{episodes?.length ? episodes.map((episode) => <Link className="compact-row" href={`/admin/episodes/${episode.id}`} key={episode.id}><strong>{episode.procedure_name}</strong><span>{doctorNames.get(episode.doctor_id) || episode.status} →</span></Link>) : <EmptyState title="Nenhum episódio" description="Procedimentos e acompanhamentos aparecerão aqui." />}</article>
      <article className="panel"><h2>Conversas</h2>{conversations?.length ? conversations.map((conversation) => <div className="compact-row" key={conversation.id}><strong>{conversation.mode}</strong><span>{conversation.status}</span></div>) : <EmptyState title="Nenhuma conversa" description="O histórico conversacional ficará vinculado a este paciente." />}</article></section></main>;
}
