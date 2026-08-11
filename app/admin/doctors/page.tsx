import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createDoctor } from "./actions";
import { FormDrawer } from "@/components/admin/form-drawer";
import { PageToolbar, SearchInput } from "@/components/admin/page-toolbar";
import Link from "next/link";

export default async function DoctorsPage({ searchParams }: { searchParams: Promise<{ q?: string; created?: string; updated?: string; error?: string }> }) {
  const params = await searchParams;
  const context = await getAdminContext();
  const supabase = await createClient();
  const organizationId = context.organization?.id;
  let query = supabase.from("doctors").select("id, display_name, specialty, professional_registration, status").order("display_name");
  if (organizationId) query = query.eq("organization_id", organizationId);
  if (params.q) query = query.ilike("display_name", `%${params.q}%`);
  const { data: doctors } = organizationId ? await query : { data: [] };
  const ids = doctors?.map((doctor) => doctor.id) ?? [];
  const { data: episodes } = ids.length ? await supabase.from("care_episodes").select("doctor_id").in("doctor_id", ids).in("status", ["planned", "preoperative", "postoperative"]) : { data: [] };
  const counts = new Map<string, number>();
  episodes?.forEach(({ doctor_id }) => counts.set(doctor_id, (counts.get(doctor_id) ?? 0) + 1));
  const manageable = can(context.role, "doctors:manage");

  return <main className="admin-content"><PageHeader eyebrow="GESTÃO" title="Médicos" description="Gerencie os profissionais e seus acompanhamentos ativos." />
    <PageToolbar><form className="search-form"><SearchInput defaultValue={params.q} placeholder="Buscar médicos" /></form></PageToolbar>
    <section className="page-feedback">
      {params.created || params.updated ? <p className="success-message">Médico salvo com sucesso.</p> : null}{params.error ? <p className="form-error">Não foi possível concluir a operação.</p> : null}
    </section>
    {manageable ? <FormDrawer label="Novo médico" title="Novo médico" description="Adicione um profissional à organização."><form action={createDoctor} className="drawer-form"><fieldset><legend>Informações básicas</legend><label>Nome de exibição<input name="display_name" required /></label><label>Especialidade<input name="specialty" /></label></fieldset><fieldset><legend>Registro profissional</legend><label>Número do registro<input name="professional_registration" /></label></fieldset><button>Cadastrar médico</button></form></FormDrawer> : null}
    <section className="panel table-panel">{doctors?.length ? <div className="data-table">{doctors.map((doctor) => <Link className="doctor-row" href={`/admin/doctors/${doctor.id}`} key={doctor.id}><span className="row-avatar">{doctor.display_name[0]}</span><div className="doctor-summary"><strong>{doctor.display_name}</strong><small>{doctor.specialty || "Especialidade não informada"} · {doctor.professional_registration || "Sem registro"}</small></div><span className="status-badge">{doctor.status === "active" ? "Ativo" : "Inativo"}</span><span className="episode-count">{counts.get(doctor.id) ?? 0} episódios ativos</span><span>→</span></Link>)}</div> : <EmptyState title="Nenhum médico" description="Cadastre o primeiro profissional da organização." />}</section>
  </main>;
}
