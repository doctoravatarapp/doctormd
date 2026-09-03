import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { createPatient } from "./actions";
import { FormDrawer } from "@/components/admin/form-drawer";
import { PageToolbar, SearchInput } from "@/components/admin/page-toolbar";
import { ADMIN_PAGE_SIZE, pageNumber, Pagination } from "@/components/admin/pagination";

type PatientsPageProps = { searchParams: Promise<{ q?: string; page?: string; error?: string; created?: string }> };

export default async function PatientsPage({ searchParams }: PatientsPageProps) {
  const params = await searchParams;
  const context = await getAdminContext();
  const supabase = await createClient();
  const page = pageNumber(params.page);
  let query = supabase.from("patients").select("id, full_name, preferred_name, email, phone, status, created_at", { count: "exact" }).order("created_at", { ascending: false });
  if (context.organization) query = query.eq("organization_id", context.organization.id);
  if (params.q) query = query.ilike("full_name", `%${params.q}%`);
  const { data: patients, count } = context.organization ? await query.range((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE - 1) : { data: [], count: 0 };

  return (
    <main className="admin-content">
      <PageHeader eyebrow="OPERAÇÃO" title="Pacientes" description="Identidade operacional e acompanhamentos organizados por episódio." />
      <PageToolbar><form className="search-form"><SearchInput defaultValue={params.q} placeholder="Buscar pacientes" /></form></PageToolbar>
      <section className="page-feedback">
        {params.created ? <p className="success-message">Paciente cadastrado com sucesso.</p> : null}
        {params.error ? <p className="form-error">Não foi possível concluir. Revise os dados e tente novamente.</p> : null}
      </section>
      <FormDrawer label="Novo paciente" title="Novo paciente" description="Cadastre os dados essenciais para iniciar um acompanhamento."><form action={createPatient} className="drawer-form"><label>Nome completo<input name="full_name" required /></label><label>Nome preferido<input name="preferred_name" /></label><label>E-mail<input name="email" type="email" /></label><label>Telefone<input name="phone" /></label><label>Data de nascimento<input name="birth_date" type="date" /></label><button type="submit">Cadastrar paciente</button></form></FormDrawer>
      <section className="panel table-panel">
        {patients?.length ? <div className="data-table">{patients.map((patient) => <Link href={`/admin/patients/${patient.id}`} className="data-row" key={patient.id}><span className="row-avatar">{patient.full_name.slice(0, 1)}</span><div><strong>{patient.preferred_name || patient.full_name}</strong><small>{patient.email || patient.phone || "Contato não informado"}</small></div><span className="status-badge">{patient.status === "active" ? "Ativo" : "Inativo"}</span><span>→</span></Link>)}</div> : <EmptyState icon="◎" title="Nenhum paciente encontrado" description={params.q ? "Tente outro termo de busca." : "Cadastre o primeiro paciente quando sua operação estiver pronta."} />}
      </section>
      <Pagination page={page} total={count ?? 0} pathname="/admin/patients" params={{ q: params.q }} />
    </main>
  );
}
