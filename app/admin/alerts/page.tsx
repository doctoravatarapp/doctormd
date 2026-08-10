import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export default async function AlertsPage() {
  const context = await getAdminContext(); const supabase = await createClient(); if (!context.organization) return null;
  const [{ data: red }, { data: semantic }] = await Promise.all([
    supabase.from("red_flag_events").select("id,patient_id,conversation_id,severity,status,created_at").eq("organization_id", context.organization.id).in("status", ["new", "acknowledged"]).order("created_at", { ascending: false }),
    supabase.from("semantic_review_events").select("id,patient_id,conversation_id,category,confidence,status,created_at,classifier_version").eq("organization_id", context.organization.id).in("status", ["new", "acknowledged"]).order("created_at", { ascending: false }),
  ]);
  const patientIds = [...new Set([...(red ?? []), ...(semantic ?? [])].flatMap(item => item.patient_id ? [item.patient_id] : []))];
  const { data: patients } = patientIds.length ? await supabase.from("patients").select("id,full_name,preferred_name").in("id", patientIds) : { data: [] };
  const names = new Map(patients?.map(patient => [patient.id, patient.preferred_name || patient.full_name]));
  const items = [
    ...(red ?? []).map(item => ({ ...item, source: "Regra configurada", detail: item.severity })),
    ...(semantic ?? []).map(item => ({ ...item, source: "Sinalização da IA", detail: `Confiança operacional: ${Number(item.confidence).toFixed(2)}` })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return <main className="admin-content"><PageHeader eyebrow="ALERTAS" title="Atenção no momento certo." description="Sinalizações operacionais para avaliação humana, com origem explícita."/><section className="panel table-panel">{items.length ? <div className="data-table">{items.map(item => <Link href={`/admin/conversations/${item.conversation_id}`} className="data-row" key={`${item.source}-${item.id}`}><span className="row-avatar">△</span><div><strong>{item.patient_id ? names.get(item.patient_id) : "Paciente"} · {item.source}</strong><small>{item.detail} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}</small></div><span>{item.status} →</span></Link>)}</div> : <EmptyState icon="△" title="Nenhum alerta encontrado" description="Sinalizações determinísticas ou semânticas aparecerão aqui."/>}</section></main>;
}
