import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { loadOperationalQueue } from "@/lib/operations/load-queue";
import { PRIORITY_LABELS, REASON_LABELS } from "@/lib/operations/priority";

export default async function DashboardPage() {
  const context = await getAdminContext();
  const supabase = await createClient();
  const organizationId = context.organization?.id;
  const operationQueue = organizationId ? await loadOperationalQueue(supabase, organizationId) : [];
  const attentionNow = operationQueue.filter((item) => item.operation.priority === "urgent" || item.operation.priority === "high").sort((a, b) => a.operation.since.localeCompare(b.operation.since)).slice(0, 5);

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
  const { data: attention } = organizationId ? await supabase.from("red_flag_events").select("id, patient_id, conversation_id, rule_id, message_id, severity, status, created_at").eq("organization_id", organizationId).in("status", ["new", "acknowledged"]).order("created_at").limit(5) : { data: [] };
  const attentionPatientIds=[...new Set(attention?.flatMap(item=>item.patient_id?[item.patient_id]:[])??[])], attentionRuleIds=[...new Set(attention?.flatMap(item=>item.rule_id?[item.rule_id]:[])??[])], attentionMessageIds=[...new Set(attention?.flatMap(item=>item.message_id?[item.message_id]:[])??[])];
  const [{data:attentionPatients},{data:attentionRules},{data:attentionMessages}]=await Promise.all([attentionPatientIds.length?supabase.from("patients").select("id,full_name,preferred_name").in("id",attentionPatientIds):Promise.resolve({data:[]}),attentionRuleIds.length?supabase.from("red_flag_rules").select("id,name").in("id",attentionRuleIds):Promise.resolve({data:[]}),attentionMessageIds.length?supabase.from("messages").select("id,content").in("id",attentionMessageIds):Promise.resolve({data:[]})]);
  const attentionNames=new Map(attentionPatients?.map(p=>[p.id,p.preferred_name||p.full_name])),attentionRuleNames=new Map(attentionRules?.map(r=>[r.id,r.name])),attentionText=new Map(attentionMessages?.map(m=>[m.id,m.content]));
  const [activeAutomations, scheduledMessages, automationFailures] = organizationId ? await Promise.all([
    supabase.from("episode_automations").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "active"),
    supabase.from("scheduled_actions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "pending"),
    supabase.from("scheduled_actions").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "failed"),
  ]) : [emptyCount, emptyCount, emptyCount];

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
      <section className="automation-metrics panel"><div><strong>{activeAutomations.count ?? 0}</strong><span>Acompanhamentos automatizados</span></div><div><strong>{scheduledMessages.count ?? 0}</strong><span>Mensagens programadas</span></div><div><strong>{automationFailures.count ?? 0}</strong><span>Falhas de automação</span></div></section>
      <section className="panel"><div className="panel-title"><h2>Atenção agora</h2><Link href="/admin/operations">Ver Central Operacional</Link></div>{attentionNow.length ? attentionNow.map((item) => <Link className="compact-row" href={`/admin/episodes/${item.id}`} key={item.id}><div><strong>{item.patientName} · {PRIORITY_LABELS[item.operation.priority]}</strong><small>{item.operation.reasons.map((reason) => REASON_LABELS[reason]).join(" · ")}</small></div><span>Abrir →</span></Link>) : <EmptyState icon="✓" title="Sem atenção operacional pendente" description="Nenhum acompanhamento está em prioridade alta agora." />}</section>
      <section className="dashboard-grid">
        <article className="panel panel-wide"><div className="panel-title"><h2>Conversas recentes</h2><span>Atualizado agora</span></div><EmptyState icon="◌" title="Nenhuma conversa ainda" description="As conversas dos pacientes aparecerão aqui quando forem iniciadas." /></article>
        <article className="panel"><div className="panel-title"><h2>Necessitam atenção</h2></div>{attention?.length?attention.map(item=><Link className="attention-row" href={`/admin/conversations/${item.conversation_id}`} key={item.id}><div><strong>{item.patient_id?attentionNames.get(item.patient_id):"Paciente"}</strong><span>{item.rule_id?attentionRuleNames.get(item.rule_id):"Alerta"} · {item.severity}</span></div><p>{item.message_id?`${attentionText.get(item.message_id)?.slice(0,80)??""}${(attentionText.get(item.message_id)?.length??0)>80?"…":""}`:""}</p><small>{item.status} · aguardando desde {new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit"}).format(new Date(item.created_at))}</small></Link>):<EmptyState icon="△" title="Tudo tranquilo" description="Nenhum alerta ou intervenção pendente." />}</article>
        <article className="panel panel-wide"><div className="panel-title"><h2>Acompanhamentos recentes</h2></div>{recentEpisodes?.length ? recentEpisodes.map((episode) => <a className="compact-row" href={`/admin/episodes/${episode.id}`} key={episode.id}><strong>{patientNames.get(episode.patient_id) || "Paciente"} · {episode.procedure_name}</strong><span>{episode.status} →</span></a>) : <EmptyState icon="◎" title="Sem episódios ativos" description="Os acompanhamentos pré e pós-operatórios serão resumidos aqui." />}</article>
      </section>
    </main>
  );
}
