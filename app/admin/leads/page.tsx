import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { PageToolbar, SearchInput } from "@/components/admin/page-toolbar";
import { getAdminContext } from "@/lib/auth/context";
import { can } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_PAGE_SIZE, pageNumber, Pagination } from "@/components/admin/pagination";

const statusLabels={new:"Novo",contacted:"Contatado",qualified:"Qualificado",won:"Ganho",lost:"Perdido"} as const;
const goalLabels={productivity:"Produtividade", "follow-up":"Acompanhamento", "patient-experience":"Experiência do paciente",automation:"Automação",other:"Outro"} as const;
const validStatuses=new Set(Object.keys(statusLabels));
const formatDate=(value:string)=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(value));

export default async function LeadsPage({searchParams}:{searchParams:Promise<{q?:string;status?:string;page?:string;updated?:string}>}){
  const params=await searchParams,context=await getAdminContext();
  if(!can(context.role,"leads:view")||!context.organization)redirect("/admin");
  const admin=createAdminClient(),q=(params.q??"").trim().replace(/[,%_()]/g," ").slice(0,80),status=validStatuses.has(params.status??"")?params.status:"",organizationId=context.organization.id,page=pageNumber(params.page);
  let query=admin.from("sales_leads").select("id,full_name,email,phone,organization_name,team_size,primary_goal,status,created_at",{count:"exact"}).eq("organization_id",organizationId).order("created_at",{ascending:false});
  if(q)query=query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,organization_name.ilike.%${q}%`);
  if(status)query=query.eq("status",status as keyof typeof statusLabels);
  const [{data:leads,count},{data:allStatuses}]=await Promise.all([query.range((page-1)*ADMIN_PAGE_SIZE,page*ADMIN_PAGE_SIZE-1),admin.from("sales_leads").select("status").eq("organization_id",organizationId)]);
  const counts=Object.keys(statusLabels).reduce<Record<string,number>>((map,key)=>{map[key]=allStatuses?.filter(row=>row.status===key).length??0;return map},{});
  return <main className="admin-content leads-page"><PageHeader eyebrow="COMERCIAL" title="Leads" description="Acompanhe os profissionais interessados no APolloMD e avance cada oportunidade."/>
    <section className="lead-metrics" aria-label="Resumo do funil"><div><small>Novos</small><strong>{counts.new}</strong></div><div><small>Contatados</small><strong>{counts.contacted}</strong></div><div><small>Qualificados</small><strong>{counts.qualified}</strong></div><div><small>Ganhos</small><strong>{counts.won}</strong></div></section>
    <PageToolbar><form className="lead-filters"><SearchInput defaultValue={params.q} placeholder="Buscar nome, e-mail ou clínica"/><select name="status" defaultValue={status} aria-label="Filtrar por status"><option value="">Todos os status</option>{Object.entries(statusLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select><button>Filtrar</button></form></PageToolbar>
    {params.updated?<p className="success-message">Status do lead atualizado.</p>:null}
    <section className="panel table-panel">{leads?.length?<div className="data-table">{leads.map(lead=><Link className="lead-row" href={`/admin/leads/${lead.id}`} key={lead.id}><span className="row-avatar">{lead.full_name.slice(0,2).toUpperCase()}</span><div className="lead-summary"><strong>{lead.full_name}</strong><small>{lead.organization_name||"Organização não informada"} · {lead.email}</small></div><span className={`status-badge lead-status-${lead.status}`}>{statusLabels[lead.status]}</span><span className="lead-goal">{lead.primary_goal?goalLabels[lead.primary_goal]:"Objetivo não informado"}</span><time>{formatDate(lead.created_at)}</time><span>→</span></Link>)}</div>:<EmptyState icon="↗" title="Nenhum lead encontrado" description={q||status?"Ajuste os filtros para encontrar outras oportunidades.":"As solicitações enviadas pela landing page aparecerão aqui."}/>}</section><Pagination page={page} total={count??0} pathname="/admin/leads" params={{q:params.q,status}}/>
  </main>
}
