import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { createPatient } from "./actions";

type PatientsPageProps = { searchParams: Promise<{ q?: string; error?: string; created?: string }> };

export default async function PatientsPage({ searchParams }: PatientsPageProps) {
  const params = await searchParams;
  const context = await getAdminContext();
  const supabase = await createClient();
  const query = supabase.from("patients").select("id, full_name, preferred_name, email, phone, status, created_at").order("created_at", { ascending: false });
  const { data: patients } = context.organization
    ? await (params.q ? query.eq("organization_id", context.organization.id).ilike("full_name", `%${params.q}%`) : query.eq("organization_id", context.organization.id))
    : { data: [] };

  return (
    <main className="admin-content">
      <PageHeader eyebrow="PACIENTES" title="Pessoas, não registros." description="Identidade operacional e acompanhamentos organizados por episódio." />
      <section className="panel patient-tools">
        <form className="search-form"><input name="q" defaultValue={params.q} placeholder="Buscar paciente pelo nome" /><button>Buscar</button></form>
        <details className="create-disclosure"><summary>Novo paciente</summary><form action={createPatient} className="patient-form"><input name="full_name" placeholder="Nome completo *" required /><input name="preferred_name" placeholder="Nome preferido" /><input name="email" type="email" placeholder="E-mail" /><input name="phone" placeholder="Telefone" /><input name="birth_date" type="date" aria-label="Data de nascimento" /><button type="submit">Cadastrar paciente</button></form></details>
        {params.created ? <p className="success-message">Paciente cadastrado com sucesso.</p> : null}
        {params.error ? <p className="form-error">Não foi possível concluir. Revise os dados e tente novamente.</p> : null}
      </section>
      <section className="panel table-panel">
        {patients?.length ? <div className="data-table">{patients.map((patient) => <Link href={`/admin/patients/${patient.id}`} className="data-row" key={patient.id}><span className="row-avatar">{patient.full_name.slice(0, 1)}</span><div><strong>{patient.preferred_name || patient.full_name}</strong><small>{patient.email || patient.phone || "Contato não informado"}</small></div><span className="status-badge">{patient.status === "active" ? "Ativo" : "Inativo"}</span><span>→</span></Link>)}</div> : <EmptyState icon="◎" title="Nenhum paciente encontrado" description={params.q ? "Tente outro termo de busca." : "Cadastre o primeiro paciente quando sua operação estiver pronta."} />}
      </section>
    </main>
  );
}
