import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateLeadStatus } from "./actions";

const statusLabels={new:"Novo",contacted:"Contatado",qualified:"Qualificado",won:"Ganho",lost:"Perdido"} as const;
const goalLabels={productivity:"Aumentar produtividade", "follow-up":"Melhorar acompanhamento", "patient-experience":"Humanizar a experiência",automation:"Automatizar rotinas",other:"Outro"} as const;
const teamLabels={solo:"Somente o profissional","2-5":"2 a 5 pessoas","6-15":"6 a 15 pessoas","16-50":"16 a 50 pessoas","51+":"Mais de 50 pessoas"} as const;

export default async function LeadDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string}>}){
  const{id}=await params,{error}=await searchParams,context=await getAdminContext();if(!can(context.role,"leads:view")||!context.organization)redirect("/admin");
  const{data:lead}=await createAdminClient().from("sales_leads").select("*").eq("id",id).eq("organization_id",context.organization.id).maybeSingle();if(!lead)notFound();
  const created=new Intl.DateTimeFormat("pt-BR",{dateStyle:"long",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(lead.created_at));
  return <main className="admin-content crud-detail lead-detail"><PageHeader eyebrow="LEAD COMERCIAL" title={lead.full_name} description={`${lead.organization_name||"Organização não informada"} · recebido em ${created}`} action={<Link className="secondary-link" href="/admin/leads">← Voltar aos leads</Link>}/>
    {error?<p className="form-error">Não foi possível atualizar o lead.</p>:null}
    <section className="panel lead-contact-card"><h2>Contato e interesse</h2><dl><div><dt>E-mail</dt><dd><a href={`mailto:${lead.email}`}>{lead.email}</a></dd></div><div><dt>WhatsApp</dt><dd>{lead.phone?<a href={`tel:${lead.phone}`}>{lead.phone}</a>:"Não informado"}</dd></div><div><dt>Organização</dt><dd>{lead.organization_name||"Não informada"}</dd></div><div><dt>Tamanho da equipe</dt><dd>{lead.team_size?teamLabels[lead.team_size]:"Não informado"}</dd></div><div><dt>Principal objetivo</dt><dd>{lead.primary_goal?goalLabels[lead.primary_goal]:"Não informado"}</dd></div><div><dt>Origem</dt><dd>{lead.source==="landing_page"?"Landing page":"Outra origem"}</dd></div></dl></section>
    <section className="panel crud-status lead-status-editor"><div><strong>Etapa do funil</strong><p className="muted-copy">Atualize o status conforme o relacionamento comercial evolui.</p></div><form action={updateLeadStatus}><input type="hidden" name="id" value={lead.id}/><select name="status" defaultValue={lead.status} aria-label="Status do lead">{Object.entries(statusLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><button>Salvar status</button></form></section>
    <section className="panel lead-privacy-note"><strong>Uso responsável</strong><p className="muted-copy">Este registro é exclusivamente comercial. Não inclua dados de pacientes ou informações clínicas no processo de qualificação.</p></section>
  </main>
}
