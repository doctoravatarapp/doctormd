import "server-only";
import type {createAdminClient} from "@/lib/supabase/admin";
import {AI_CONFIG}from"@/lib/ai/config";
import {CONTEXT_VERSION}from"@/lib/ai/prompts/patient-assistant-v2";
type Admin=ReturnType<typeof createAdminClient>;
export type AssistantSettings={displayName:string;style:"concise"|"balanced"|"detailed";customInstructions:string;version:number};
export async function buildPatientAiContext(db:Admin,input:{organizationId:string;patientId:string;episodeId:string;conversationId:string;doctorId:string;patientName:string;procedureName:string;episodeStatus:string;conversationMode:string;doctorName:string;specialty:string|null}){
 const [{data:org},{data:settings},{data:automation},{data:responses},{data:history}]=await Promise.all([
  db.from("organizations").select("timezone").eq("id",input.organizationId).single(),
  db.from("doctor_ai_settings").select("display_name,communication_style,custom_instructions,version,is_active").eq("organization_id",input.organizationId).eq("doctor_id",input.doctorId).maybeSingle(),
  db.from("episode_automations").select("status").eq("care_episode_id",input.episodeId).order("created_at",{ascending:false}).limit(1).maybeSingle(),
  db.from("automation_responses").select("response_type,text_value,number_value,boolean_value,selected_option,skipped,answered_at,automation_step_id").eq("conversation_id",input.conversationId).order("answered_at",{ascending:false}).limit(5),
  db.from("messages").select("sender_type,content").eq("conversation_id",input.conversationId).in("sender_type",["patient","ai"]).order("created_at",{ascending:false}).limit(AI_CONFIG.historyMessages)
 ]);
 const stepIds=responses?.map(r=>r.automation_step_id)??[],{data:steps}=stepIds.length?await db.from("automation_steps").select("id,message_content").in("id",stepIds):{data:[]};const prompts=new Map(steps?.map(s=>[s.id,s.message_content]));
 const assistant:AssistantSettings=settings?.is_active?{displayName:settings.display_name,style:settings.communication_style,customInstructions:settings.custom_instructions||"",version:settings.version}:{displayName:"APolloMD",style:"balanced",customInstructions:"",version:1};
 const structured=(responses??[]).reverse().map(r=>({question:prompts.get(r.automation_step_id)||"Pergunta do acompanhamento",answer:r.skipped?"Prefiro não responder":r.selected_option??r.text_value??r.number_value??r.boolean_value}));
 return{version:CONTEXT_VERSION,assistant,summary:{patient:input.patientName,doctor:input.doctorName,specialty:input.specialty,procedure:input.procedureName,episodeStatus:input.episodeStatus,conversationMode:input.conversationMode,automationStatus:automation?.status||"none",timezone:org?.timezone||"UTC"},structuredResponses:structured,history:(history??[]).reverse()};
}
