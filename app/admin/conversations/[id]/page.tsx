import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { getAdminContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

export default async function AdminConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const context = await getAdminContext(); if (!context.organization) notFound(); const supabase = await createClient();
  const { data: conversation } = await supabase.from("conversations").select("id, patient_id, care_episode_id, mode, status").eq("id", id).eq("organization_id", context.organization.id).maybeSingle(); if (!conversation?.care_episode_id) notFound();
  const [{ data: patient }, { data: episode }, { data: messages }] = await Promise.all([supabase.from("patients").select("full_name, preferred_name").eq("id", conversation.patient_id).single(), supabase.from("care_episodes").select("procedure_name, doctor_id").eq("id", conversation.care_episode_id).single(), supabase.from("messages").select("id, sender_type, content, created_at").eq("conversation_id", conversation.id).order("created_at")]);
  const { data: doctor } = episode ? await supabase.from("doctors").select("display_name").eq("id", episode.doctor_id).single() : { data: null };
  return <main className="admin-content"><PageHeader eyebrow="CONVERSA" title={patient?.preferred_name || patient?.full_name || "Paciente"} description={`${episode?.procedure_name || "Acompanhamento"} · ${doctor?.display_name || "Equipe"}`} /><section className="panel admin-message-history">{messages?.length ? messages.map((message) => <article className={`admin-message ${message.sender_type}`} key={message.id}><div><strong>{message.sender_type === "patient" ? "Paciente" : message.sender_type === "ai" ? "APolloMD/IA" : "Equipe"}</strong><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(message.created_at))}</time></div><p>{message.content}</p></article>) : <p className="muted-copy">Ainda não há mensagens nesta conversa.</p>}</section></main>;
}
