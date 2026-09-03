import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_PAGE_SIZE, pageNumber, Pagination } from "@/components/admin/pagination";

type Filters = { search?: string; status?: string; page?: string };
type EpisodeStatus = "planned" | "preoperative" | "postoperative" | "completed" | "cancelled";

const statusLabels: Record<string, string> = {
  planned: "Planejado",
  preoperative: "Pré-operatório",
  postoperative: "Pós-operatório",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export default async function EpisodesPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const filters = await searchParams;
  const context = await getAdminContext();
  if (!context.organization) return null;

  const db = await createClient();
  const page = pageNumber(filters.page);
  const search = filters.search?.trim().replace(/[,%_()]/g, " ").slice(0, 80) ?? "";
  const [{ data: matchingPatients }, { data: matchingDoctors }] = search ? await Promise.all([
    db.from("patients").select("id").eq("organization_id", context.organization.id).ilike("full_name", `%${search}%`).limit(100),
    db.from("doctors").select("id").eq("organization_id", context.organization.id).ilike("display_name", `%${search}%`).limit(100),
  ]) : [{ data: [] }, { data: [] }];
  let episodeQuery = db
    .from("care_episodes")
    .select("id,patient_id,doctor_id,procedure_name,procedure_date,status,updated_at", { count: "exact" })
    .eq("organization_id", context.organization.id)
    .order("updated_at", { ascending: false });

  if (filters.status && filters.status in statusLabels) episodeQuery = episodeQuery.eq("status", filters.status as EpisodeStatus);
  if (search) {
    const conditions = [`procedure_name.ilike.%${search}%`];
    if (matchingPatients?.length) conditions.push(`patient_id.in.(${matchingPatients.map(({ id }) => id).join(",")})`);
    if (matchingDoctors?.length) conditions.push(`doctor_id.in.(${matchingDoctors.map(({ id }) => id).join(",")})`);
    episodeQuery = episodeQuery.or(conditions.join(","));
  }
  const { data: episodes, count } = await episodeQuery.range((page - 1) * ADMIN_PAGE_SIZE, page * ADMIN_PAGE_SIZE - 1);
  const patientIds = [...new Set(episodes?.map((episode) => episode.patient_id) ?? [])];
  const doctorIds = [...new Set(episodes?.map((episode) => episode.doctor_id) ?? [])];
  const [{ data: patients }, { data: doctors }] = await Promise.all([
    patientIds.length
      ? db.from("patients").select("id,full_name,preferred_name").eq("organization_id", context.organization.id).in("id", patientIds)
      : Promise.resolve({ data: [] }),
    doctorIds.length
      ? db.from("doctors").select("id,display_name").eq("organization_id", context.organization.id).in("id", doctorIds)
      : Promise.resolve({ data: [] }),
  ]);

  const patientNames = new Map(patients?.map((patient) => [patient.id, patient.preferred_name || patient.full_name]));
  const doctorNames = new Map(doctors?.map((doctor) => [doctor.id, doctor.display_name]));
  const visibleEpisodes = episodes ?? [];

  return <main className="admin-content episodes-page">
    <PageHeader eyebrow="OPERAÇÃO" title="Acompanhamentos" description="Consulte jornadas em andamento e o histórico de episódios dos pacientes." />
    <form className="panel operation-filters episode-filters" method="get">
      <input name="search" defaultValue={filters.search} placeholder="Buscar paciente, procedimento ou médico" />
      <select name="status" defaultValue={filters.status ?? ""}>
        <option value="">Todos os status</option>
        {Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
      <button>Filtrar</button>
      {(filters.search || filters.status) ? <Link className="secondary-link" href="/admin/episodes">Limpar</Link> : null}
    </form>
    <section className="panel table-panel">
      {visibleEpisodes.length ? <div className="data-table">{visibleEpisodes.map((episode) => <Link className="data-row episode-list-row" href={`/admin/episodes/${episode.id}`} key={episode.id}>
        <span className="row-avatar">◎</span>
        <div><strong>{episode.procedure_name}</strong><small>{patientNames.get(episode.patient_id) || "Paciente não encontrado"} · {doctorNames.get(episode.doctor_id) || "Médico não encontrado"}</small></div>
        <span className="status-badge">{statusLabels[episode.status] ?? episode.status}</span>
        <small>{episode.procedure_date ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${episode.procedure_date}T12:00:00`)) : "Sem data"}</small>
        <span>→</span>
      </Link>)}</div> : <EmptyState icon="◎" title="Nenhum acompanhamento encontrado" description={search || filters.status ? "Ajuste os filtros para ampliar a busca." : "Os acompanhamentos criados para pacientes aparecerão aqui."} />}
    </section>
    <Pagination page={page} total={count ?? 0} pathname="/admin/episodes" params={{ search: filters.search, status: filters.status }} />
  </main>;
}
