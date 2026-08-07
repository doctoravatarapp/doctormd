import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createDoctor, toggleDoctorStatus, updateDoctor } from "./actions";

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

  return <main className="admin-content"><PageHeader eyebrow="MÉDICOS" title="Equipe assistencial." description="Profissionais e acompanhamentos ativos da organização." />
    <section className="panel patient-tools"><form className="search-form"><input name="q" defaultValue={params.q} placeholder="Buscar médico pelo nome" /><button>Buscar</button></form>
      {manageable ? <details className="create-disclosure"><summary>Novo médico</summary><form action={createDoctor} className="patient-form"><input name="display_name" placeholder="Nome de exibição *" required /><input name="specialty" placeholder="Especialidade" /><input name="professional_registration" placeholder="Registro profissional" /><button>Cadastrar médico</button></form></details> : null}
      {params.created || params.updated ? <p className="success-message">Médico salvo com sucesso.</p> : null}{params.error ? <p className="form-error">Não foi possível concluir a operação.</p> : null}
    </section>
    <section className="panel table-panel">{doctors?.length ? <div className="data-table">{doctors.map((doctor) => <article className="doctor-row" key={doctor.id}><span className="row-avatar">{doctor.display_name[0]}</span><div className="doctor-summary"><strong>{doctor.display_name}</strong><small>{doctor.specialty || "Especialidade não informada"} · {doctor.professional_registration || "Sem registro"}</small></div><span className="status-badge">{doctor.status === "active" ? "Ativo" : "Inativo"}</span><span className="episode-count">{counts.get(doctor.id) ?? 0} episódios ativos</span>{manageable ? <details><summary>Editar</summary><form action={updateDoctor} className="inline-edit"><input type="hidden" name="id" value={doctor.id} /><input name="display_name" defaultValue={doctor.display_name} required /><input name="specialty" defaultValue={doctor.specialty ?? ""} placeholder="Especialidade" /><input name="professional_registration" defaultValue={doctor.professional_registration ?? ""} placeholder="Registro" /><button>Salvar</button></form><form action={toggleDoctorStatus}><input type="hidden" name="id" value={doctor.id} /><input type="hidden" name="status" value={doctor.status} /><button className="text-button">{doctor.status === "active" ? "Inativar" : "Ativar"}</button></form></details> : null}</article>)}</div> : <EmptyState title="Nenhum médico" description="Cadastre o primeiro profissional da organização." />}</section>
  </main>;
}
