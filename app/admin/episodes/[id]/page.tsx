import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { assignAutomation, controlAutomation } from "./actions";
import { generateEpisodeSummary } from "./summary-actions";
import { calculateOperationalPriority, PRIORITY_LABELS, REASON_LABELS } from "@/lib/operations/priority";

type SummaryItem = { text: string; source_message_ids: string[]; source_response_ids: string[]; source_alert_ids: string[] };
type SummaryContent = { overview: string; key_patient_reports: SummaryItem[]; structured_answers: SummaryItem[]; alerts_summary: SummaryItem[]; human_interventions: SummaryItem[]; current_state: string };
type TimelineItem = { id: string; at: string; category: "Conversa" | "Alertas" | "Automação" | "Intervenções"; title: string; detail: string };

export default async function EpisodePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ assigned?: string; error?: string; summary?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const context = await getAdminContext();
  if (!context.organization) notFound();
  const db = await createClient();
  const { data: episode } = await db.from("care_episodes").select("id,patient_id,doctor_id,procedure_name,procedure_date,status,started_at,created_at,updated_at").eq("organization_id", context.organization.id).eq("id", id).maybeSingle();
  if (!episode) notFound();
  const [{ data: patient }, { data: doctor }, { data: conversations }, { data: flows }, { data: assignments }, { data: summaries }] = await Promise.all([
    db.from("patients").select("id,full_name,preferred_name").eq("id", episode.patient_id).single(),
    db.from("doctors").select("display_name,specialty").eq("id", episode.doctor_id).single(),
    db.from("conversations").select("id,status,mode,last_message_at,created_at,updated_at,taken_over_at").eq("care_episode_id", id),
    db.from("automation_flows").select("id,name,version").eq("organization_id", context.organization.id).eq("status", "active").order("name"),
    db.from("episode_automations").select("id,flow_id,flow_version,status,current_step_id,created_at,updated_at,completed_at").eq("care_episode_id", id).order("created_at", { ascending: false }),
    db.from("episode_ai_summaries").select("id,summary_version,status,source_updated_at,overview,structured_content,model,prompt_version,generated_at,created_at").eq("care_episode_id", id).order("summary_version", { ascending: false }).limit(20),
  ]);
  const conversationIds = conversations?.map((row) => row.id) ?? [];
  const assignmentIds = assignments?.map((row) => row.id) ?? [];
  const flowIds = assignments?.map((row) => row.flow_id) ?? [];
  const [{ data: actions }, { data: usedFlows }, { data: responses }, { data: messages }, { data: redFlags }, { data: semanticAlerts }, { data: interventions }] = await Promise.all([
    assignmentIds.length ? db.from("scheduled_actions").select("id,episode_automation_id,automation_step_id,step_position,step_name,step_type,scheduled_for,status,executed_at,message_id,updated_at").in("episode_automation_id", assignmentIds).order("step_position") : Promise.resolve({ data: [] }),
    flowIds.length ? db.from("automation_flows").select("id,name").in("id", flowIds) : Promise.resolve({ data: [] }),
    assignmentIds.length ? db.from("automation_responses").select("id,episode_automation_id,automation_step_id,response_type,text_value,number_value,boolean_value,selected_option,skipped,answered_at").in("episode_automation_id", assignmentIds).order("answered_at") : Promise.resolve({ data: [] }),
    conversationIds.length ? db.from("messages").select("id,conversation_id,sender_type,content,created_at,scheduled_action_id").in("conversation_id", conversationIds).order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    conversationIds.length ? db.from("red_flag_events").select("id,conversation_id,message_id,severity,status,created_at,rule_id").in("conversation_id", conversationIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    db.from("semantic_review_events").select("id,conversation_id,message_id,category,confidence,status,created_at").eq("care_episode_id", id).order("created_at", { ascending: false }),
    db.from("audit_logs").select("id,action,entity_id,metadata,created_at").eq("organization_id", context.organization.id).in("action", ["conversation.taken_over", "conversation.ai_resumed", "doctor.message_sent"]).order("created_at", { ascending: false }).limit(100),
  ]);
  const relatedInterventions = (interventions ?? []).filter((row) => conversationIds.includes(row.entity_id ?? "") || conversationIds.includes(String((row.metadata as { conversation_id?: string } | null)?.conversation_id ?? "")));
  const flowNames = new Map(usedFlows?.map((flow) => [flow.id, flow.name]));
  const format = (date: string | null) => date ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(date)) : "—";
  const conversation = conversations?.[0];
  const automation = assignments?.[0];
  const openAlerts = [...(redFlags ?? []), ...(semanticAlerts ?? [])].filter((row) => row.status === "new" || row.status === "acknowledged").length;
  const nextAction = actions?.filter((row) => row.status === "pending" || row.status === "failed").sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))[0];
  const relevantDates = [episode.updated_at, ...(conversations ?? []).flatMap((row) => [row.updated_at, row.last_message_at].filter(Boolean) as string[]), ...(messages ?? []).map((row) => row.created_at), ...(responses ?? []).map((row) => row.answered_at), ...(redFlags ?? []).map((row) => row.created_at), ...(semanticAlerts ?? []).map((row) => row.created_at), ...(actions ?? []).map((row) => row.updated_at), ...relatedInterventions.map((row) => row.created_at)];
  const latestSource = relevantDates.sort().at(-1) ?? episode.updated_at;
  const latestSummary = summaries?.find((row) => row.status === "completed");
  const generating = summaries?.some((row) => row.status === "generating");
  const stale = Boolean(latestSummary && latestSource > latestSummary.source_updated_at);
  const summary = latestSummary?.structured_content as SummaryContent | null;
  const operational = calculateOperationalPriority({ conversation: conversation ? { mode: conversation.mode, updatedAt: conversation.updated_at, takenOverAt: conversation.taken_over_at } : null, deterministicAlerts: (redFlags ?? []).map((row) => ({ severity: row.severity, status: row.status, createdAt: row.created_at })), semanticAlerts: (semanticAlerts ?? []).map((row) => ({ status: row.status, createdAt: row.created_at })), automation: automation ? { status: automation.status, updatedAt: automation.updated_at } : null, actions: (actions ?? []).map((row) => ({ status: row.status, scheduledFor: row.scheduled_for, executedAt: row.executed_at, stepType: row.step_type })), latestPatientMessageAt: messages?.find((row) => row.sender_type === "patient")?.created_at ?? null });
  const timeline: TimelineItem[] = [
    { id: `episode-${id}`, at: episode.created_at, category: "Automação" as const, title: "Acompanhamento criado", detail: episode.procedure_name },
    ...(actions ?? []).map((row) => ({ id: `action-${row.id}`, at: row.executed_at ?? row.scheduled_for, category: "Automação" as const, title: row.status === "completed" ? "Etapa de automação executada" : "Etapa de automação programada", detail: row.step_name })),
    ...(messages ?? []).map((row) => ({ id: `message-${row.id}`, at: row.created_at, category: "Conversa" as const, title: row.sender_type === "patient" ? "Mensagem do paciente" : row.sender_type === "doctor" ? "Mensagem do médico" : row.sender_type === "ai" ? "Resposta da IA" : "Mensagem do sistema", detail: row.content })),
    ...(responses ?? []).map((row) => ({ id: `response-${row.id}`, at: row.answered_at, category: "Automação" as const, title: "Resposta estruturada coletada", detail: responseValue(row) })),
    ...(redFlags ?? []).map((row) => ({ id: `alert-${row.id}`, at: row.created_at, category: "Alertas" as const, title: "Sinalização por regra configurada", detail: `${row.severity} · ${row.status}` })),
    ...(semanticAlerts ?? []).map((row) => ({ id: `alert-${row.id}`, at: row.created_at, category: "Alertas" as const, title: "Sinalização da IA para revisão", detail: `${row.category} · confiança ${Math.round(Number(row.confidence) * 100)}% · ${row.status}` })),
    ...relatedInterventions.map((row) => ({ id: `intervention-${row.id}`, at: row.created_at, category: "Intervenções" as const, title: row.action === "conversation.taken_over" ? "Médico assumiu a conversa" : row.action === "conversation.ai_resumed" ? "Atendimento devolvido à IA" : "Médico respondeu", detail: "Intervenção humana registrada" })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return <main className="admin-content">
    <PageHeader eyebrow="ACOMPANHAMENTO" title={episode.procedure_name} description={`${patient?.preferred_name || patient?.full_name || "Paciente"} · ${episode.status}`} />
    {query.assigned ? <p className="success-message">Automação associada e agendada.</p> : null}
    {query.summary === "updated" ? <p className="success-message">Resumo APolloMD atualizado.</p> : null}
    {query.summary === "busy" ? <p className="form-error">Já existe uma geração em andamento. Atualize a página em instantes.</p> : null}
    {query.summary === "error" ? <p className="form-error">Não foi possível atualizar o resumo. A versão anterior foi preservada e você pode tentar novamente.</p> : null}

    <section className="detail-grid">
      <article className="panel info-card"><h2>Cabeçalho do acompanhamento</h2><dl><div><dt>Paciente</dt><dd><Link href={`/admin/patients/${episode.patient_id}`}>{patient?.full_name}</Link></dd></div><div><dt>Médico responsável</dt><dd>{doctor?.display_name || "Não encontrado"}</dd></div><div><dt>Procedimento</dt><dd>{episode.procedure_name}</dd></div><div><dt>Data</dt><dd>{episode.procedure_date || "Não informada"}</dd></div><div><dt>Status / fase</dt><dd>{episode.status}</dd></div><div><dt>Conversa</dt><dd>{conversationMode(conversation?.mode)}</dd></div><div><dt>Automação atual</dt><dd>{automation?.status || "Nenhuma"}</dd></div></dl></article>
      <article className="panel"><h2>Visão rápida</h2><div className="detail-grid"><Quick label="Conversa" value={conversationMode(conversation?.mode)} /><Quick label="Automação" value={automation?.status || "Nenhuma"} /><Quick label="Alertas abertos" value={String(openAlerts)} /><Quick label="Última interação" value={format(conversation?.last_message_at ?? null)} /><Quick label="Próxima ação" value={nextAction ? format(nextAction.scheduled_for) : automation?.status === "waiting_response" ? "Aguardando paciente" : "Nenhuma"} /></div></article>
    </section>

    <section className={`panel operation-item priority-${operational.priority}`}><p className="eyebrow">SITUAÇÃO OPERACIONAL — NÃO CLÍNICA</p><h2>Prioridade: {PRIORITY_LABELS[operational.priority]}</h2><ul>{operational.reasons.map((reason) => <li key={reason}>{REASON_LABELS[reason]}</li>)}</ul><p>Desde: {format(operational.since)}</p></section>

    <section className="panel"><div className="section-heading"><div><p className="eyebrow">GERADO POR IA</p><h2>Resumo APolloMD</h2></div>{stale ? <span className="status-pill warning">Atualização disponível</span> : latestSummary ? <span className="status-pill">Atualizado</span> : null}</div>
      {!summary ? <p>Nenhum resumo gerado ainda.</p> : <><SummaryBlock title="Visão geral" text={summary.overview} /><SummaryList title="Relatos do paciente" items={summary.key_patient_reports} /><SummaryList title="Respostas coletadas" items={summary.structured_answers} /><SummaryList title="Alertas" items={summary.alerts_summary} /><SummaryList title="Intervenções" items={summary.human_interventions} /><SummaryBlock title="Estado atual descrito pela IA" text={summary.current_state} /><small>Versão {latestSummary?.summary_version} · {latestSummary?.model} · {latestSummary?.prompt_version} · {format(latestSummary?.generated_at ?? null)}</small></>}
      <form action={generateEpisodeSummary}><input type="hidden" name="episode_id" value={id} /><button disabled={generating}>{generating ? "Gerando…" : latestSummary ? "Atualizar resumo" : "Gerar resumo"}</button></form>
      <p className="muted-copy">Representação operacional derivada. Consulte sempre as fontes originais abaixo.</p>
    </section>

    <section className="detail-grid">
      <article className="panel"><h2>Estado atual factual</h2><p>Conversa: <strong>{conversation?.mode ?? "sem conversa"}</strong></p><p>Automação: <strong>{automation?.status ?? "sem automação"}</strong></p><p>Alertas abertos: <strong>{openAlerts}</strong></p><p>Próxima ação: <strong>{nextAction ? format(nextAction.scheduled_for) : automation?.status === "waiting_response" ? "aguardando paciente" : "nenhuma"}</strong></p></article>
      <article className="panel"><h2>Alertas</h2>{!(redFlags?.length || semanticAlerts?.length) ? <p>Nenhum alerta neste acompanhamento.</p> : null}{redFlags?.map((row) => <div className="compact-row" id={`alert-${row.id}`} key={row.id}><div><strong>Regra configurada</strong><small>deterministic_rule · {row.severity}</small></div><span>{row.status} · {format(row.created_at)}</span></div>)}{semanticAlerts?.map((row) => <div className="compact-row" id={`alert-${row.id}`} key={row.id}><div><strong>Sinalização da IA</strong><small>semantic_classifier · confiança {Math.round(Number(row.confidence) * 100)}%</small></div><span>{row.status} · {format(row.created_at)}</span></div>)}</article>
    </section>

    <section className="panel"><h2>Linha do tempo operacional</h2><p className="muted-copy">Todos · Conversa · Alertas · Automação · Intervenções</p>{timeline.map((row) => <div className="compact-row" id={row.id} key={row.id}><div><strong>{row.title}</strong><small>{row.category} · {row.detail}</small></div><span>{format(row.at)}</span></div>)}</section>

    <section className="detail-grid">
      <article className="panel"><h2>Respostas coletadas</h2>{responses?.length ? responses.map((row) => { const action = actions?.find((item) => item.automation_step_id === row.automation_step_id); const assignment = assignments?.find((item) => item.id === row.episode_automation_id); return <div className="compact-row" id={`response-${row.id}`} key={row.id}><div><strong>{action?.step_name || "Pergunta"}</strong><small>{flowNames.get(assignment?.flow_id || "") || "Fluxo"} · {row.response_type}</small></div><span>{responseValue(row)} · {format(row.answered_at)}</span></div>; }) : <p>Nenhuma resposta estruturada ainda.</p>}</article>
      <article className="panel"><h2>Intervenções humanas</h2>{relatedInterventions.length ? relatedInterventions.map((row) => <div className="compact-row" key={row.id}><strong>{row.action === "conversation.taken_over" ? "Médico assumiu a conversa" : row.action === "conversation.ai_resumed" ? "Atendimento devolvido à IA" : "Médico respondeu"}</strong><span>{format(row.created_at)}</span></div>) : <p>Nenhuma intervenção registrada.</p>}</article>
    </section>

    <section className="detail-grid">
      <article className="panel"><h2>Conversa</h2>{conversation ? <Link href={`/admin/conversations/${conversation.id}`}>Abrir conversa e fontes originais</Link> : <p>Nenhuma conversa.</p>}{messages?.slice(0, 8).map((row) => <div className="compact-row" id={`message-${row.id}`} key={row.id}><div><strong>{row.sender_type}</strong><small>{row.content}</small></div><span>{format(row.created_at)}</span></div>)}</article>
      <article className="panel automation-episode"><h2>Automação</h2>{assignments?.map((item) => { const own = actions?.filter((row) => row.episode_automation_id === item.id) ?? []; const next = own.find((row) => row.status === "pending" || row.status === "failed"); return <section key={item.id}><strong>{flowNames.get(item.flow_id) || "Fluxo"} · v{item.flow_version}</strong><p>{item.status} · {own.filter((row) => row.status === "completed").length} de {own.length} etapas</p>{next ? <small>Próxima: {format(next.scheduled_for)}</small> : null}<div className="automation-controls">{item.status === "active" ? <Control assignment={item.id} episode={id} status="paused" label="Pausar" /> : item.status === "paused" ? <Control assignment={item.id} episode={id} status="active" label="Retomar" /> : null}{!['completed','cancelled'].includes(item.status) ? <Control assignment={item.id} episode={id} status="cancelled" label="Cancelar" /> : null}</div></section>; })}{!assignments?.some((item) => ["active","paused","waiting_response"].includes(item.status)) && flows?.length ? <form action={assignAutomation} className="stack-form"><input type="hidden" name="episode_id" value={id} /><select name="flow_id" required defaultValue=""><option value="" disabled>Selecionar fluxo ativo</option>{flows.map((flow) => <option value={flow.id} key={flow.id}>{flow.name} · v{flow.version}</option>)}</select><button>Adicionar automação</button></form> : null}</article>
    </section>
  </main>;
}

function Quick({ label, value }: { label: string; value: string }) { return <div className="info-card"><small>{label}</small><strong>{value}</strong></div>; }
function SummaryBlock({ title, text }: { title: string; text: string }) { return <section><h3>{title}</h3><p>{text}</p></section>; }
function SummaryList({ title, items }: { title: string; items: SummaryItem[] }) { return <section><h3>{title}</h3>{items.length ? <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item.text} <SourceLinks item={item} /></li>)}</ul> : <p>Nenhum evento registrado.</p>}</section>; }
function SourceLinks({ item }: { item: SummaryItem }) { const ids = [...item.source_message_ids.map((id) => `message-${id}`), ...item.source_response_ids.map((id) => `response-${id}`), ...item.source_alert_ids.map((id) => `alert-${id}`)]; return ids.length ? <>{ids.map((id, index) => <Link href={`#${id}`} key={id}> {index ? "· " : ""}Ver origem</Link>)}</> : null; }
function conversationMode(mode?: string) { return mode === "ai" ? "IA atendendo" : mode === "waiting_doctor" ? "Aguardando médico" : mode === "doctor" ? "Médico atendendo" : "Sem conversa"; }
function responseValue(row: { skipped: boolean; selected_option: string | null; text_value: string | null; number_value: number | null; boolean_value: boolean | null }) { return row.skipped ? "Prefiro não responder" : row.selected_option ?? row.text_value ?? (row.number_value != null ? String(row.number_value) : row.boolean_value == null ? "—" : row.boolean_value ? "Sim" : "Não"); }
function Control({ assignment, episode, status, label }: { assignment: string; episode: string; status: "active" | "paused" | "cancelled"; label: string }) { return <form action={controlAutomation}><input type="hidden" name="assignment_id" value={assignment} /><input type="hidden" name="episode_id" value={episode} /><input type="hidden" name="status" value={status} /><button className="text-button">{label}</button></form>; }
