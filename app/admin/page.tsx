import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const context = await getAdminContext();
  const supabase = await createClient();
  const organizationId = context.organization?.id;

  const emptyCount = { count: 0 };
  const [patients, episodes, conversations, alerts] = organizationId
    ? await Promise.all([
        supabase.from("patients").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active"),
        supabase.from("care_episodes").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["planned", "preoperative", "postoperative"]),
        supabase.from("conversations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "open"),
        supabase.from("red_flag_events").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["new", "acknowledged"]),
      ])
    : [emptyCount, emptyCount, emptyCount, emptyCount];
  const { data: recentEpisodes } = organizationId ? await supabase.from("care_episodes").select("id, patient_id, procedure_name, procedure_date, status").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(6) : { data: [] };
  const patientIds = [...new Set(recentEpisodes?.map((episode) => episode.patient_id) ?? [])];
  const { data: episodePatients } = patientIds.length ? await supabase.from("patients").select("id, full_name, preferred_name").in("id", patientIds) : { data: [] };
  const patientNames = new Map(episodePatients?.map((patient) => [patient.id, patient.preferred_name || patient.full_name]));

  return (
    <main className="admin-content">
      <PageHeader eyebrow="VISÃO GERAL" title="Bom trabalho começa com clareza." description="Acompanhe a operação da sua organização em um só lugar." />
      <section className="metric-grid">
        {[
          ["Pacientes ativos", patients.count ?? 0, "◎"],
          ["Acompanhamentos ativos", episodes.count ?? 0, "◌"],
          ["Conversas abertas", conversations.count ?? 0, "◇"],
          ["Alertas pendentes", alerts.count ?? 0, "△"],
        ].map(([label, value, icon]) => <article className="metric-card" key={String(label)}><span>{icon}</span><strong>{value}</strong><p>{label}</p></article>)}
      </section>
      <section className="dashboard-grid">
        <article className="panel panel-wide"><div className="panel-title"><h2>Conversas recentes</h2><span>Atualizado agora</span></div><EmptyState icon="◌" title="Nenhuma conversa ainda" description="As conversas dos pacientes aparecerão aqui quando forem iniciadas." /></article>
        <article className="panel"><div className="panel-title"><h2>Necessitam atenção</h2></div><EmptyState icon="△" title="Tudo tranquilo" description="Nenhum alerta ou intervenção pendente." /></article>
        <article className="panel panel-wide"><div className="panel-title"><h2>Acompanhamentos recentes</h2></div>{recentEpisodes?.length ? recentEpisodes.map((episode) => <a className="compact-row" href={`/admin/episodes/${episode.id}`} key={episode.id}><strong>{patientNames.get(episode.patient_id) || "Paciente"} · {episode.procedure_name}</strong><span>{episode.status} →</span></a>) : <EmptyState icon="◎" title="Sem episódios ativos" description="Os acompanhamentos pré e pós-operatórios serão resumidos aqui." />}</article>
      </section>
    </main>
  );
}
