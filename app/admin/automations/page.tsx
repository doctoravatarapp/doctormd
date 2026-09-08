import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";
import { FormDrawer } from "@/components/admin/form-drawer";
import { PageHeader } from "@/components/admin/page-header";
import { ADMIN_PAGE_SIZE, pageNumber, Pagination } from "@/components/admin/pagination";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { createFlow } from "./actions";

export default async function AutomationsPage({ searchParams }: { searchParams: Promise<{ page?: string; saved?: string; error?: string }> }) {
  const params = await searchParams;
  const page = pageNumber(params.page);
  const context = await getAdminContext();
  const db = await createClient();
  const { data: flows, count: total } = context.organization
    ? await db.from("automation_flows").select("id,name,description,status,version,updated_at", { count: "exact" }).eq("organization_id", context.organization.id).order("updated_at", { ascending: false }).range((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE - 1)
    : { data: [], count: 0 };
  const ids = flows?.map((flow) => flow.id) ?? [];
  const [{ data: steps }, { data: assignments }] = ids.length ? await Promise.all([
    db.from("automation_steps").select("flow_id").in("flow_id", ids),
    db.from("episode_automations").select("flow_id").in("flow_id", ids),
  ]) : [{ data: [] }, { data: [] }];
  const itemCount = (items: { flow_id: string }[] | null, id: string) => items?.filter((item) => item.flow_id === id).length ?? 0;

  return <main className="admin-content">
    <PageHeader eyebrow="GESTÃO" title="Automações" description="Configure fluxos de acompanhamento enviados pelo ApolloMD." />
    <section className="page-feedback">{params.saved ? <p className="success-message">Automação salva.</p> : null}{params.error ? <p className="form-error">Não foi possível concluir.</p> : null}</section>
    <section className="panel table-panel">{flows?.length ? <div className="data-table">{flows.map((flow) => <Link className="data-row" href={`/admin/automations/${flow.id}`} key={flow.id}><span className="row-avatar">◇</span><div><strong>{flow.name}</strong><small>{itemCount(steps, flow.id)} etapas · v{flow.version} · {itemCount(assignments, flow.id)} acompanhamentos</small></div><span className="status-badge">{flow.status}</span><span>→</span></Link>)}</div> : <EmptyState icon="◇" title="Nenhum fluxo" description="Crie o primeiro fluxo para automatizar acompanhamentos." />}</section>
    <Pagination page={page} total={total ?? 0} pathname="/admin/automations" />
    <FormDrawer label="Nova automação" title="Nova automação" description="Crie a estrutura inicial do fluxo."><form action={createFlow} className="drawer-form"><label>Nome do fluxo<input name="name" required /></label><label>Descrição<input name="description" /></label><button>Criar fluxo</button></form></FormDrawer>
  </main>;
}
