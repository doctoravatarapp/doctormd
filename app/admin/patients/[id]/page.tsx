import { notFound } from "next/navigation";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getAdminContext();
  if (!context.organization) notFound();
  const supabase = await createClient();
  const { data: patient } = await supabase.from("patients").select("id, full_name, preferred_name, email, phone, birth_date, status, created_at").eq("organization_id", context.organization.id).eq("id", id).maybeSingle();
  if (!patient) notFound();
  const [{ data: episodes }, { data: conversations }] = await Promise.all([
    supabase.from("care_episodes").select("id, procedure_name, procedure_date, status").eq("organization_id", context.organization.id).eq("patient_id", id).order("created_at", { ascending: false }),
    supabase.from("conversations").select("id, status, mode, last_message_at").eq("organization_id", context.organization.id).eq("patient_id", id).order("last_message_at", { ascending: false }),
  ]);

  return <main className="admin-content"><PageHeader eyebrow="PACIENTE" title={patient.preferred_name || patient.full_name} description={`${patient.full_name} · ${patient.status === "active" ? "Ativo" : "Inativo"}`} /><section className="detail-grid"><article className="panel info-card"><h2>Identidade e contato</h2><dl><div><dt>E-mail</dt><dd>{patient.email || "Não informado"}</dd></div><div><dt>Telefone</dt><dd>{patient.phone || "Não informado"}</dd></div><div><dt>Nascimento</dt><dd>{patient.birth_date ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${patient.birth_date}T12:00:00`)) : "Não informado"}</dd></div></dl></article><article className="panel"><h2>Episódios</h2>{episodes?.length ? episodes.map((episode) => <div className="compact-row" key={episode.id}><strong>{episode.procedure_name}</strong><span>{episode.status}</span></div>) : <EmptyState title="Nenhum episódio" description="Procedimentos e acompanhamentos aparecerão aqui." />}</article><article className="panel"><h2>Conversas</h2>{conversations?.length ? conversations.map((conversation) => <div className="compact-row" key={conversation.id}><strong>{conversation.mode}</strong><span>{conversation.status}</span></div>) : <EmptyState title="Nenhuma conversa" description="O histórico conversacional ficará vinculado a este paciente." />}</article></section></main>;
}
