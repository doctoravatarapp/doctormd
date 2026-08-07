import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const context = await getAdminContext(); if (!context.organization) notFound();
  const supabase = await createClient();
  const { data: episode } = await supabase.from("care_episodes").select("id, patient_id, doctor_id, procedure_name, procedure_date, status, created_at").eq("organization_id", context.organization.id).eq("id", id).maybeSingle();
  if (!episode) notFound();
  const [{ data: patient }, { data: doctor }, { data: conversations }] = await Promise.all([
    supabase.from("patients").select("id, full_name, preferred_name").eq("id", episode.patient_id).single(),
    supabase.from("doctors").select("display_name, specialty").eq("id", episode.doctor_id).single(),
    supabase.from("conversations").select("id, status, mode, last_message_at").eq("care_episode_id", episode.id).order("created_at"),
  ]);
  return <main className="admin-content"><PageHeader eyebrow="ACOMPANHAMENTO" title={episode.procedure_name} description={`${patient?.preferred_name || patient?.full_name || "Paciente"} · ${episode.status}`} /><section className="detail-grid"><article className="panel info-card"><h2>Dados do episódio</h2><dl><div><dt>Paciente</dt><dd><Link href={`/admin/patients/${episode.patient_id}`}>{patient?.full_name}</Link></dd></div><div><dt>Médico</dt><dd>{doctor?.display_name || "Não encontrado"}</dd></div><div><dt>Especialidade</dt><dd>{doctor?.specialty || "Não informada"}</dd></div><div><dt>Procedimento</dt><dd>{episode.procedure_name}</dd></div><div><dt>Data</dt><dd>{episode.procedure_date ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${episode.procedure_date}T12:00:00`)) : "Não informada"}</dd></div><div><dt>Status</dt><dd>{episode.status}</dd></div></dl></article><article className="panel"><h2>Conversa principal</h2>{conversations?.map((conversation) => <div className="compact-row" key={conversation.id}><strong>{conversation.mode}</strong><span>{conversation.status}</span></div>)}</article></section></main>;
}
