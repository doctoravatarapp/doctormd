import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { toggleDoctorStatus, updateDoctor } from "../actions";

export default async function DoctorDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [{ id }, query, context] = await Promise.all([params, searchParams, getAdminContext()]);
  if (!context.organization) notFound();
  const db = await createClient();
  const { data: doctor } = await db.from("doctors").select("id,display_name,specialty,professional_registration,status").eq("id", id).eq("organization_id", context.organization.id).maybeSingle();
  if (!doctor) notFound();
  const { data: episodes } = await db.from("care_episodes").select("id,procedure_name,status").eq("doctor_id", id).eq("organization_id", context.organization.id).order("created_at", { ascending: false }).limit(8);
  const manageable = can(context.role, "doctors:manage");
  return <main className="admin-content crud-detail"><PageHeader eyebrow="MÉDICO" title={doctor.display_name} description={`${doctor.specialty || "Especialidade não informada"} · ${doctor.status === "active" ? "Ativo" : "Inativo"}`} />
    {query.saved ? <p className="success-message">Médico atualizado.</p> : null}{query.error ? <p className="form-error">Não foi possível salvar o médico.</p> : null}
    <section className="panel"><h2>Dados profissionais</h2>{manageable ? <form action={updateDoctor} className="settings-form"><input type="hidden" name="id" value={doctor.id} /><label>Nome de exibição<input name="display_name" defaultValue={doctor.display_name} required /></label><label>Especialidade<input name="specialty" defaultValue={doctor.specialty ?? ""} /></label><label>Registro profissional<input name="professional_registration" defaultValue={doctor.professional_registration ?? ""} /></label><button>Salvar alterações</button></form> : <p className="muted-copy">Você possui acesso somente para consulta.</p>}</section>
    {manageable ? <section className="panel crud-status"><div><strong>Status do médico</strong><p className="muted-copy">Médicos inativos permanecem no histórico, mas não recebem novos acompanhamentos.</p></div><form action={toggleDoctorStatus}><input type="hidden" name="id" value={doctor.id} /><input type="hidden" name="status" value={doctor.status} /><button className="secondary-action">{doctor.status === "active" ? "Inativar médico" : "Ativar médico"}</button></form></section> : null}
    <section className="panel"><h2>Acompanhamentos recentes</h2>{episodes?.length ? episodes.map((episode) => <Link className="compact-row" href={`/admin/episodes/${episode.id}`} key={episode.id}><strong>{episode.procedure_name}</strong><span>{episode.status} →</span></Link>) : <p className="muted-copy">Nenhum acompanhamento vinculado.</p>}</section>
  </main>;
}
