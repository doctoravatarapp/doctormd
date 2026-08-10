import { notFound } from "next/navigation";
import { PatientChat } from "@/components/patient/chat";
import { getPatientContext } from "@/lib/auth/patient-context";
import { createClient } from "@/lib/supabase/server";
import { PatientShell } from "@/components/patient/patient-shell";

export default async function PatientChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { patient } = await getPatientContext(); const supabase = await createClient();
  const { data: conversation } = await supabase.from("conversations").select("id, care_episode_id, mode").eq("id", id).eq("patient_id", patient.id).eq("status", "open").maybeSingle(); if (!conversation?.care_episode_id) notFound();
  const { data: episode } = await supabase.from("care_episodes").select("procedure_name, doctor_id").eq("id", conversation.care_episode_id).eq("patient_id", patient.id).single(); if (!episode) notFound();
  const [{ data: doctor }, { data: messages }, { data: assignment }, {data:episodes}] = await Promise.all([supabase.from("doctors").select("display_name").eq("id", episode.doctor_id).single(), supabase.from("messages").select("id, sender_type, content, created_at").eq("conversation_id", conversation.id).order("created_at"),supabase.from("episode_automations").select("id,current_step_id,status").eq("care_episode_id",conversation.care_episode_id).eq("status","waiting_response").maybeSingle(),supabase.from("care_episodes").select("id,procedure_name,status").eq("patient_id",patient.id).in("status",["planned","preoperative","postoperative"])]);
  const episodeIds=episodes?.map(item=>item.id)??[],{data:allConversations}=episodeIds.length?await supabase.from("conversations").select("id,care_episode_id").in("care_episode_id",episodeIds).eq("status","open"):{data:[]};
  const {data:question}=assignment?.current_step_id?await supabase.from("scheduled_actions").select("automation_step_id,response_type,response_options,response_required,response_min,response_max,response_unit").eq("episode_automation_id",assignment.id).eq("automation_step_id",assignment.current_step_id).maybeSingle():{data:null};
  const items=episodes?.flatMap(item=>{const own=allConversations?.find(row=>row.care_episode_id===item.id);return own?[{href:`/patient/chat/${own.id}`,title:item.procedure_name,subtitle:item.status,active:own.id===id}]:[]})??[];
  return <PatientShell patientName={patient.preferred_name||patient.full_name} currentTitle={episode.procedure_name} currentSubtitle={`${doctor?.display_name || "Equipe de cuidado"}`} conversations={items}><main className="patient-chat-shell"><PatientChat conversationId={conversation.id} initialMessages={messages ?? []} initialMode={conversation.mode} initialQuestion={question} /></main></PatientShell>;
}
