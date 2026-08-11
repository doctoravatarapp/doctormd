import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export default async function PatientDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { id } = await params; const query = await searchParams; const context = await getAdminContext(); if (!context.organization) notFound();
  const supabase = await createClient();
  const { data: patient } = await supabase.from("patients").select("id, full_name, preferred_name, email, phone, birth_date, status, auth_user_id").eq("organization_id", context.organization.id).eq("id", id).maybeSingle();
  if (!patient) notFound();
  const [{ data: episodes }, { data: conversations }, { data: doctors }] = await Promise.all([
    supabase.from("care_episodes").select("id, doctor_id, procedure_name, procedure_date, status").eq("organization_id", context.organization.id).eq("patient_id", id).order("created_at", { ascending: false }),
    supabase.from("conversations").select("id, status, mode, last_message_at").eq("organization_id", context.organization.id).eq("patient_id", id).order("last_message_at", { ascending: false }),
    supabase.from("doctors").select("id, display_name").eq("organization_id", context.organization.id).order("display_name"),
  ]);
  const conversationIds = conversations?.map((item) => item.id) ?? [];
  const { count: pendingAlerts } = conversationIds.length ? await supabase.from("red_flag_events").select("id", { count: "exact", head: true }).in("conversation_id", conversationIds).in("status", ["new", "acknowledged"]) : { count: 0 };
  const doctorNames = new Map(doctors?.map((doctor) => [doctor.id, doctor.display_name]));

  const activeEpisodes = episodes?.filter((episode) => ["planned", "preoperative", "postoperative"].includes(episode.status)).length ?? 0;
  const birthDate = patient.birth_date ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${patient.birth_date}T12:00:00`)) : "Não informado";

  return <main className="admin-content patient-detail-page"><PageHeader eyebrow="PACIENTE" title={patient.preferred_name || patient.full_name} description={patient.full_name} action={<div className="header-actions"><Link className="secondary-link" href={`/admin/patients/${patient.id}/edit`}>Editar dados</Link><Link className="primary-link" href={`/admin/patients/${patient.id}/episodes/new`}>Novo acompanhamento</Link></div>} />
    {query.saved ? <p className="success-message">Paciente atualizado.</p> : null}{query.error ? <p className="form-error">Não foi possível concluir. Revise os dados.</p> : null}
    <section className="patient-overview-strip"><div><small>Status</small><strong className="status-badge">{patient.status === "active" ? "Ativo" : "Inativo"}</strong></div><div><small>Acompanhamentos ativos</small><strong>{activeEpisodes}</strong></div><div><small>Alertas pendentes</small><strong>{pendingAlerts ?? 0}</strong></div><div><small>Acesso</small><strong>{patient.auth_user_id ? "Vinculado" : "Pendente"}</strong></div></section>
    <section className="patient-detail-layout"><div className="patient-detail-main"><article className="panel"><div className="panel-title"><h2>Acompanhamentos</h2><Link href={`/admin/patients/${patient.id}/episodes/new`}>Adicionar</Link></div>{episodes?.length ? episodes.map((episode) => <Link className="patient-episode-row" href={`/admin/episodes/${episode.id}`} key={episode.id}><div><strong>{episode.procedure_name}</strong><small>{doctorNames.get(episode.doctor_id) || "Médico não encontrado"}{episode.procedure_date ? ` · ${new Intl.DateTimeFormat("pt-BR").format(new Date(`${episode.procedure_date}T12:00:00`))}` : ""}</small></div><span className="status-badge">{episode.status}</span><b>→</b></Link>) : <EmptyState title="Nenhum acompanhamento" description="Crie o primeiro acompanhamento para iniciar a jornada deste paciente." />}</article>
      <article className="panel"><h2>Conversas</h2>{conversations?.length ? conversations.map((conversation) => <Link className="patient-conversation-row" href={`/admin/conversations/${conversation.id}`} key={conversation.id}><div><strong>{conversation.mode === "doctor" ? "Atendimento médico" : conversation.mode === "waiting_doctor" ? "Aguardando médico" : "Atendimento pela IA"}</strong><small>{conversation.last_message_at ? `Última interação em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(conversation.last_message_at))}` : "Sem mensagens"}</small></div><span>{conversation.status} →</span></Link>) : <EmptyState title="Nenhuma conversa" description="As conversas aparecerão quando um acompanhamento for iniciado." />}</article></div>
      <aside className="panel patient-profile-card"><div className="panel-title"><h2>Dados do paciente</h2><Link href={`/admin/patients/${patient.id}/edit`}>Editar</Link></div><dl><div><dt>E-mail</dt><dd>{patient.email || "Não informado"}</dd></div><div><dt>Telefone</dt><dd>{patient.phone || "Não informado"}</dd></div><div><dt>Nascimento</dt><dd>{birthDate}</dd></div><div><dt>Nome completo</dt><dd>{patient.full_name}</dd></div></dl></aside></section>
  </main>;
}
