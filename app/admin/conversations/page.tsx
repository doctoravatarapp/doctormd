import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

const modeLabels = { ai: "IA atendendo", waiting_doctor: "Aguardando médico", doctor: "Médico atendendo" } as const;
export default async function ConversationsPage() {
  const context = await getAdminContext(); const supabase = await createClient();
  const { data: conversations } = context.organization ? await supabase.from("conversations").select("id, patient_id, status, mode, last_message_at").eq("organization_id", context.organization.id).order("last_message_at", { ascending: false }) : { data: [] };
  const patientIds = [...new Set(conversations?.map((item) => item.patient_id) ?? [])]; const { data: patients } = patientIds.length ? await supabase.from("patients").select("id, full_name, preferred_name").in("id", patientIds) : { data: [] }; const names = new Map(patients?.map((patient) => [patient.id, patient.preferred_name || patient.full_name]));
  return <main className="admin-content"><PageHeader eyebrow="CONVERSAS" title="Contexto para cuidar melhor." description="Acompanhe interações da IA e identifique quando a presença humana é necessária." /><section className="panel table-panel">{conversations?.length ? <div className="data-table">{conversations.map((conversation) => <Link href={`/admin/conversations/${conversation.id}`} className="data-row" key={conversation.id}><span className="row-avatar">◌</span><div><strong>{names.get(conversation.patient_id) || "Paciente"}</strong><small>{modeLabels[conversation.mode]} · {conversation.last_message_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(conversation.last_message_at)) : "Sem mensagens"}</small></div><span className={`mode-badge mode-${conversation.mode}`}>{conversation.status}</span><span>→</span></Link>)}</div> : <EmptyState icon="◌" title="Nenhuma conversa iniciada" description="As interações vinculadas a pacientes e episódios aparecerão aqui." />}</section></main>;
}
