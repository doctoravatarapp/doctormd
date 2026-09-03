import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_PAGE_SIZE, pageNumber, Pagination } from "@/components/admin/pagination";

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams; const page = pageNumber(params.page); const fetchEnd = page * ADMIN_PAGE_SIZE - 1;
  const context = await getAdminContext(); const supabase = await createClient(); if (!context.organization) return null;
  const [{ data: red, count: redCount }, { data: semantic, count: semanticCount }] = await Promise.all([
    supabase.from("red_flag_events").select("id,patient_id,conversation_id,rule_id,severity,status,created_at", { count: "exact" }).eq("organization_id", context.organization.id).in("status", ["new", "acknowledged"]).order("created_at", { ascending: false }).range(0, fetchEnd),
    supabase.from("semantic_review_events").select("id,patient_id,conversation_id,category,confidence,status,created_at,classifier_version", { count: "exact" }).eq("organization_id", context.organization.id).in("status", ["new", "acknowledged"]).order("created_at", { ascending: false }).range(0, fetchEnd),
  ]);
  const patientIds = [...new Set([...(red ?? []), ...(semantic ?? [])].flatMap(item => item.patient_id ? [item.patient_id] : []))];
  const ruleIds = [...new Set((red ?? []).flatMap(item => item.rule_id ? [item.rule_id] : []))];
  const [{ data: patients }, {data:rules}] = await Promise.all([patientIds.length ? supabase.from("patients").select("id,full_name,preferred_name").in("id", patientIds) : Promise.resolve({ data: [] }),ruleIds.length?supabase.from("red_flag_rules").select("id,category,signal,priority,recommended_action").in("id",ruleIds):Promise.resolve({data:[]})]);
  const names = new Map(patients?.map(patient => [patient.id, patient.preferred_name || patient.full_name]));
  const rulesById = new Map(rules?.map(rule=>[rule.id,rule]));
  const items = [
    ...(red ?? []).map(item => {const rule=item.rule_id?rulesById.get(item.rule_id):null;return ({ ...item, source: rule?.signal||"Regra configurada", detail: `${rule?.category||"Sem categoria"} · ${priorityLabel(rule?.priority)} · Ação: ${rule?.recommended_action||"Consultar equipe"}` });}),
    ...(semantic ?? []).map(item => ({ ...item, source: "Sinalização da IA", detail: `Confiança operacional: ${Number(item.confidence).toFixed(2)}` })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE);
  return <main className="admin-content"><PageHeader eyebrow="ALERTAS" title="Atenção no momento certo." description="Sinalizações operacionais para avaliação humana, com origem explícita."/><section className="panel table-panel">{items.length ? <div className="data-table">{items.map(item => <Link href={`/admin/conversations/${item.conversation_id}`} className="data-row" key={`${item.source}-${item.id}`}><span className="row-avatar">△</span><div><strong>{item.patient_id ? names.get(item.patient_id) : "Paciente"} · {item.source}</strong><small>{item.detail} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}</small></div><span>{item.status} →</span></Link>)}</div> : <EmptyState icon="△" title="Nenhum alerta encontrado" description="Sinalizações determinísticas ou semânticas aparecerão aqui."/>}</section><Pagination page={page} total={(redCount ?? 0) + (semanticCount ?? 0)} pathname="/admin/alerts" /></main>;
}

function priorityLabel(priority?: string|null){if(priority==="immediate_emergency")return "Emergência imediata";if(priority==="contact_surgeon")return "Contatar o cirurgião";if(priority==="home_guidance")return "Orientação domiciliar";return "Prioridade não informada";}
