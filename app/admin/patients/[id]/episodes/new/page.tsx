import { notFound } from "next/navigation";
import { createEpisode } from "@/app/admin/episodes/actions";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function NewEpisodePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, query, context] = await Promise.all([params, searchParams, getAdminContext()]);
  if (!context.organization || !can(context.role, "episodes:create")) notFound();
  const db = await createClient();
  const [{ data: patient }, { data: doctors }] = await Promise.all([db.from("patients").select("id,full_name,preferred_name").eq("id", id).eq("organization_id", context.organization.id).maybeSingle(), db.from("doctors").select("id,display_name,specialty").eq("organization_id", context.organization.id).eq("status", "active").order("display_name")]);
  if (!patient) notFound();
  return <main className="admin-content crud-detail"><PageHeader eyebrow="ACOMPANHAMENTO" title="Novo acompanhamento" description={`Inicie uma nova jornada para ${patient.preferred_name || patient.full_name}.`} />
    {query.error ? <p className="form-error">Não foi possível criar o acompanhamento. Revise os dados.</p> : null}
    <section className="panel">{doctors?.length ? <form action={createEpisode} className="settings-form"><input type="hidden" name="patient_id" value={patient.id} /><label>Procedimento<input name="procedure_name" required /></label><label>Médico responsável<select name="doctor_id" required defaultValue=""><option value="" disabled>Selecione um médico</option>{doctors.map((doctor) => <option value={doctor.id} key={doctor.id}>{doctor.display_name}{doctor.specialty ? ` · ${doctor.specialty}` : ""}</option>)}</select></label><label>Data do procedimento<input type="date" name="procedure_date" /></label><label>Fase inicial<select name="status" defaultValue="planned"><option value="planned">Planejado</option><option value="preoperative">Pré-operatório</option><option value="postoperative">Pós-operatório</option></select></label><button>Criar acompanhamento</button></form> : <p className="muted-copy">Cadastre ou ative um médico antes de criar o acompanhamento.</p>}</section>
  </main>;
}
