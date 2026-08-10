import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { loadOperationalQueue } from "@/lib/operations/load-queue";
import { OPERATIONS_THRESHOLDS, PRIORITY_LABELS, REASON_LABELS, type OperationalPriority } from "@/lib/operations/priority";
import { createClient } from "@/lib/supabase/server";
import { OperationsAutoRefresh } from "./auto-refresh";

type Filters = { view?: string; search?: string; doctor?: string; procedure?: string; status?: string; page?: string };
const ranks: Record<OperationalPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

export default async function OperationsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const filters = await searchParams;
  const context = await getAdminContext();
  if (!context.organization) return null;
  const db = await createClient();
  const queue = await loadOperationalQueue(db, context.organization.id);
  const search = filters.search?.trim().toLocaleLowerCase("pt-BR") ?? "";
  const view = filters.view ?? "all";
  const filtered = queue.filter((item) => {
    if (search && !`${item.patientName} ${item.procedure_name}`.toLocaleLowerCase("pt-BR").includes(search)) return false;
    if (filters.doctor && item.doctor_id !== filters.doctor) return false;
    if (filters.procedure && item.procedure_name !== filters.procedure) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (view === "attention" && !["urgent", "high"].includes(item.operation.priority)) return false;
    if (view === "waiting_doctor" && item.conversation?.mode !== "waiting_doctor") return false;
    if (view === "human" && item.conversation?.mode !== "doctor") return false;
    if (view === "waiting_patient" && item.automation?.status !== "waiting_response") return false;
    if (view === "automations" && !item.operation.reasons.some((reason) => reason === "automation_failed" || reason === "automation_overdue")) return false;
    if (view === "clear" && !item.operation.reasons.includes("no_pending_action")) return false;
    return true;
  }).sort((a, b) => ranks[a.operation.priority] - ranks[b.operation.priority] || a.operation.since.localeCompare(b.operation.since) || b.lastInteractionAt.localeCompare(a.lastInteractionAt));
  const page = Math.max(1, Number.parseInt(filters.page ?? "1", 10) || 1);
  const pages = Math.max(1, Math.ceil(filtered.length / OPERATIONS_THRESHOLDS.pageSize));
  const items = filtered.slice((page - 1) * OPERATIONS_THRESHOLDS.pageSize, page * OPERATIONS_THRESHOLDS.pageSize);
  const doctors = [...new Map(queue.map((item) => [item.doctor_id, item.doctorName])).entries()];
  const procedures = [...new Set(queue.map((item) => item.procedure_name))].sort();
  const waitingDoctor = queue.filter((item) => item.conversation?.mode === "waiting_doctor").length;
  const human = queue.filter((item) => item.conversation?.mode === "doctor").length;
  const waitingPatient = queue.filter((item) => item.automation?.status === "waiting_response").length;
  const failed = queue.filter((item) => item.operation.reasons.includes("automation_failed")).length;
  const attention = queue.filter((item) => ["urgent", "high"].includes(item.operation.priority)).length;
  const href = (changes: Partial<Filters>) => { const params = new URLSearchParams(); const next = { ...filters, ...changes }; for (const [key, value] of Object.entries(next)) if (value && !(key === "page" && value === "1")) params.set(key, value); return `/admin/operations${params.size ? `?${params}` : ""}`; };

  return <main className="admin-content operations-page">
    <OperationsAutoRefresh />
    <PageHeader eyebrow="PRIORIDADE OPERACIONAL — NÃO CLÍNICA" title={context.role === "doctor" ? "Minha fila" : "Central Operacional"} description="Acompanhamentos ordenados por estados e eventos reais, com motivos explícitos." />
    <section className="metric-grid">{[["Precisam de atenção", attention], ["Aguardando médico", waitingDoctor], ["Atendimento humano", human], ["Aguardando paciente", waitingPatient], ["Automação com falha", failed]].map(([label, value]) => <article className="metric-card" key={String(label)}><strong>{value}</strong><p>{label}</p></article>)}</section>
    <nav className="operation-tabs">{[["all","Todos"],["attention","Precisam de atenção"],["waiting_doctor","Aguardando médico"],["human","Atendimento humano"],["waiting_patient","Aguardando paciente"],["automations","Automações"],["clear","Sem pendências"]].map(([key,label]) => <Link className={view === key ? "active" : ""} href={href({ view: key, page: "1" })} key={key}>{label}</Link>)}</nav>
    <form className="panel operation-filters" method="get"><input type="hidden" name="view" value={view} /><input name="search" defaultValue={filters.search} placeholder="Buscar paciente ou procedimento" /><select name="doctor" defaultValue={filters.doctor ?? ""}><option value="">Todos os médicos</option>{doctors.map(([id, name]) => <option value={id} key={id}>{name}</option>)}</select><select name="procedure" defaultValue={filters.procedure ?? ""}><option value="">Todos os procedimentos</option>{procedures.map((name) => <option value={name} key={name}>{name}</option>)}</select><select name="status" defaultValue={filters.status ?? ""}><option value="">Todos os status ativos</option><option value="planned">Planejado</option><option value="preoperative">Pré-operatório</option><option value="postoperative">Pós-operatório</option></select><button>Filtrar</button></form>
    <section className="operation-queue">{items.length ? items.map((item) => <article className={`panel operation-item priority-${item.operation.priority}`} key={item.id}><div className="operation-item-main"><div><span className="operation-priority">{PRIORITY_LABELS[item.operation.priority]}</span><h2>{item.patientName}</h2><p>{item.procedure_name} · {item.doctorName}</p></div><div className="operation-state"><strong>{item.conversation?.mode === "waiting_doctor" ? "Aguardando médico" : item.conversation?.mode === "doctor" ? "Atendimento humano" : item.automation?.status === "waiting_response" ? "Aguardando paciente" : "IA atendendo"}</strong><span>{relativeTime(item.operation.since)}</span></div></div><ul>{item.operation.reasons.map((reason) => <li key={reason}>{REASON_LABELS[reason]}</li>)}</ul><div className="operation-meta"><span>Conversa: {item.conversation?.mode ?? "nenhuma"}</span><span>Automação: {item.automation?.status ?? "nenhuma"}</span><span>Alertas abertos: {item.openAlerts}</span><span>Última interação: {format(item.lastInteractionAt)}</span></div>{item.failedReason ? <p className="form-error">{item.failedReason}</p> : null}<div className="operation-actions"><Link href={`/admin/episodes/${item.id}`}>Abrir acompanhamento</Link>{item.conversation ? <Link href={`/admin/conversations/${item.conversation.id}`}>{item.conversation.mode === "doctor" ? "Continuar atendimento" : item.conversation.mode === "waiting_doctor" ? "Abrir conversa" : "Ver conversa"}</Link> : null}</div></article>) : <article className="panel"><h2>Nenhum acompanhamento neste filtro</h2><p className="muted-copy">A fila será recalculada automaticamente quando houver mudança operacional.</p></article>}</section>
    {pages > 1 ? <nav className="pagination"><Link aria-disabled={page === 1} href={href({ page: String(Math.max(1, page - 1)) })}>Anterior</Link><span>Página {Math.min(page, pages)} de {pages}</span><Link aria-disabled={page >= pages} href={href({ page: String(Math.min(pages, page + 1)) })}>Próxima</Link></nav> : null}
    <p className="muted-copy">Atualização discreta a cada 30 segundos. Os filtros e a posição de leitura são preservados.</p>
  </main>;
}

function format(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
function relativeTime(value: string) { const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000)); if (seconds < 60) return "há menos de 1 min"; if (seconds < 3600) return `há ${Math.floor(seconds / 60)} min`; if (seconds < 86400) return `há ${Math.floor(seconds / 3600)} h`; return `há ${Math.floor(seconds / 86400)} dia${seconds >= 172800 ? "s" : ""}`; }
