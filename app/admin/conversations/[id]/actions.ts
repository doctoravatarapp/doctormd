"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
const id=(form:FormData)=>String(form.get("conversation_id")??"");
const done=(conversationId:string)=>{revalidatePath(`/admin/conversations/${conversationId}`);revalidatePath("/admin/operations");revalidatePath("/admin/alerts");revalidatePath("/admin");redirect(`/admin/conversations/${conversationId}`)};
export async function takeOverConversation(form:FormData){const conversationId=id(form),supabase=await createClient();const{error}=await supabase.rpc("take_over_conversation",{target_conversation_id:conversationId});if(error)redirect(`/admin/conversations/${conversationId}?error=takeover`);done(conversationId)}
export async function sendDoctorMessage(form:FormData){const conversationId=id(form),content=String(form.get("content")??"").trim(),supabase=await createClient();if(!content)redirect(`/admin/conversations/${conversationId}?error=message`);const{error}=await supabase.rpc("send_doctor_message",{target_conversation_id:conversationId,message_content:content,target_client_message_id:crypto.randomUUID()});if(error)redirect(`/admin/conversations/${conversationId}?error=message`);done(conversationId)}
export async function resumeAiConversation(form:FormData){const conversationId=id(form),supabase=await createClient();const{error}=await supabase.rpc("resume_ai_conversation",{target_conversation_id:conversationId});if(error)redirect(`/admin/conversations/${conversationId}?error=resume`);done(conversationId)}
export async function resolveRedFlag(form:FormData){const conversationId=id(form),supabase=await createClient();const{error}=await supabase.rpc("resolve_red_flag",{target_event_id:String(form.get("event_id")??"")});if(error)redirect(`/admin/conversations/${conversationId}?error=resolve`);done(conversationId)}
