import Link from "next/link";
import { notFound } from "next/navigation";
import { PatientChat } from "@/components/patient/chat";
import { getPatientContext } from "@/lib/auth/patient-context";
import { createClient } from "@/lib/supabase/server";
import { patientLogout } from "../../login/actions";

export default async function PatientChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { patient } = await getPatientContext(); const supabase = await createClient();
  const { data: conversation } = await supabase.from("conversations").select("id, care_episode_id, mode").eq("id", id).eq("patient_id", patient.id).eq("status", "open").maybeSingle(); if (!conversation?.care_episode_id) notFound();
  const { data: episode } = await supabase.from("care_episodes").select("procedure_name, doctor_id").eq("id", conversation.care_episode_id).eq("patient_id", patient.id).single(); if (!episode) notFound();
  const [{ data: doctor }, { data: messages }, { data: assignment }] = await Promise.all([supabase.from("doctors").select("display_name").eq("id", episode.doctor_id).single(), supabase.from("messages").select("id, sender_type, content, created_at").eq("conversation_id", conversation.id).order("created_at"),supabase.from("episode_automations").select("id,current_step_id,status").eq("care_episode_id",conversation.care_episode_id).eq("status","waiting_response").maybeSingle()]);
  const {data:question}=assignment?.current_step_id?await supabase.from("scheduled_actions").select("automation_step_id,response_type,response_options,response_required,response_min,response_max,response_unit").eq("episode_automation_id",assignment.id).eq("automation_step_id",assignment.current_step_id).maybeSingle():{data:null};
  return <main className="patient-chat-shell"><header><Link href="/patient" aria-label="Voltar">←</Link><div><strong>APolloMD</strong><span>{doctor?.display_name || "Equipe de cuidado"} · {episode.procedure_name}</span></div><form action={patientLogout}><button>Sair</button></form></header><PatientChat conversationId={conversation.id} initialMessages={messages ?? []} initialMode={conversation.mode} initialQuestion={question} /></main>;
}
