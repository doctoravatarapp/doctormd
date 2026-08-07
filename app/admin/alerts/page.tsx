import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export default async function AlertsPage() {
  const context = await getAdminContext();
  const supabase = await createClient();
  const { data: alerts } = context.organization ? await supabase.from("red_flag_events").select("id, severity, status, created_at").eq("organization_id", context.organization.id).order("created_at", { ascending: false }) : { data: [] };
  return <main className="admin-content"><PageHeader eyebrow="ALERTAS" title="Atenção no momento certo." description="Ocorrências sinalizadas para avaliação humana, sem inferência diagnóstica." /><section className="panel table-panel">{alerts?.length ? <div className="data-table">{alerts.map((alert) => <div className="data-row" key={alert.id}><span className="row-avatar">△</span><div><strong>Alerta {alert.severity}</strong><small>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(alert.created_at))}</small></div><span className="status-badge">{alert.status}</span></div>)}</div> : <EmptyState icon="△" title="Nenhum alerta pendente" description="Eventos de RED Flags configuráveis serão exibidos nesta área." />}</section></main>;
}
