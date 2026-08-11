import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { updatePatient } from "../../actions";

export default async function EditPatientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ id }, query, context] = await Promise.all([params, searchParams, getAdminContext()]);
  if (!context.organization) notFound();
  const db = await createClient();
  const { data: patient } = await db.from("patients").select("id,full_name,preferred_name,email,phone,birth_date,status").eq("id", id).eq("organization_id", context.organization.id).maybeSingle();
  if (!patient) notFound();
  return <main className="admin-content crud-detail"><PageHeader eyebrow="PACIENTE" title="Editar dados" description={`Atualize somente as informações cadastrais de ${patient.preferred_name || patient.full_name}.`} />
    {query.error ? <p className="form-error">Não foi possível salvar. Revise os dados informados.</p> : null}
    <section className="panel"><form action={updatePatient} className="settings-form"><input type="hidden" name="id" value={patient.id} /><label>Nome completo<input name="full_name" defaultValue={patient.full_name} required /></label><label>Nome preferido<input name="preferred_name" defaultValue={patient.preferred_name ?? ""} /></label><label>E-mail<input name="email" type="email" defaultValue={patient.email ?? ""} /></label><label>Telefone<input name="phone" defaultValue={patient.phone ?? ""} /></label><label>Data de nascimento<input name="birth_date" type="date" defaultValue={patient.birth_date ?? ""} /></label><label>Status<select name="status" defaultValue={patient.status}><option value="active">Ativo</option><option value="inactive">Inativo</option></select></label><button>Salvar alterações</button></form></section>
  </main>;
}
