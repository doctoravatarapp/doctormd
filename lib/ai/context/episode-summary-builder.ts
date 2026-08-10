import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export async function buildEpisodeSummaryContext(db: Admin, input: { organizationId: string; episodeId: string }) {
  const { data: episode } = await db.from("care_episodes").select("id,patient_id,doctor_id,procedure_name,procedure_date,status,started_at,created_at,updated_at").eq("id", input.episodeId).eq("organization_id", input.organizationId).single();
  if (!episode) throw new Error("episode_not_found");
  const [{ data: patient }, { data: doctor }, { data: conversations }, { data: automations }] = await Promise.all([
    db.from("patients").select("id,full_name,preferred_name").eq("id", episode.patient_id).single(),
    db.from("doctors").select("id,display_name,specialty").eq("id", episode.doctor_id).single(),
    db.from("conversations").select("id,status,mode,last_message_at,created_at,updated_at").eq("care_episode_id", episode.id).eq("organization_id", input.organizationId),
    db.from("episode_automations").select("id,flow_id,status,current_step_id,created_at,updated_at,completed_at").eq("care_episode_id", episode.id).eq("organization_id", input.organizationId),
  ]);
  const conversationIds = conversations?.map((row) => row.id) ?? [];
  const automationIds = automations?.map((row) => row.id) ?? [];
  const [{ data: messages }, { data: responses }, { data: redFlags }, { data: semanticAlerts }, { data: actions }, { data: audits }] = await Promise.all([
    conversationIds.length ? db.from("messages").select("id,conversation_id,sender_type,content,created_at").in("conversation_id", conversationIds).order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
    automationIds.length ? db.from("automation_responses").select("id,episode_automation_id,automation_step_id,response_type,text_value,number_value,boolean_value,selected_option,skipped,answered_at").in("episode_automation_id", automationIds).order("answered_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    conversationIds.length ? db.from("red_flag_events").select("id,conversation_id,message_id,severity,status,created_at,rule_id").in("conversation_id", conversationIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    db.from("semantic_review_events").select("id,conversation_id,message_id,category,confidence,status,created_at").eq("care_episode_id", episode.id).eq("organization_id", input.organizationId).order("created_at", { ascending: false }),
    automationIds.length ? db.from("scheduled_actions").select("id,episode_automation_id,automation_step_id,step_name,step_type,status,scheduled_for,executed_at,message_id,updated_at").in("episode_automation_id", automationIds).order("scheduled_for", { ascending: false }) : Promise.resolve({ data: [] }),
    conversationIds.length ? db.from("audit_logs").select("id,action,entity_id,actor_user_id,metadata,created_at").eq("organization_id", input.organizationId).in("action", ["conversation.taken_over", "conversation.ai_resumed", "doctor.message_sent"]).order("created_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
  ]);
  const stepIds = responses?.map((row) => row.automation_step_id) ?? [];
  const flowIds = automations?.map((row) => row.flow_id) ?? [];
  const ruleIds = redFlags?.flatMap((row) => row.rule_id ? [row.rule_id] : []) ?? [];
  const [{ data: steps }, { data: flows }, { data: rules }] = await Promise.all([
    stepIds.length ? db.from("automation_steps").select("id,name,message_content,flow_id").in("id", stepIds) : Promise.resolve({ data: [] }),
    flowIds.length ? db.from("automation_flows").select("id,name").in("id", flowIds) : Promise.resolve({ data: [] }),
    ruleIds.length ? db.from("red_flag_rules").select("id,name").in("id", ruleIds) : Promise.resolve({ data: [] }),
  ]);
  const episodeAudits = (audits ?? []).filter((row) => conversationIds.includes(row.entity_id ?? "") || conversationIds.includes(String((row.metadata as { conversation_id?: string } | null)?.conversation_id ?? "")));
  const candidates = [episode.updated_at, ...(conversations ?? []).flatMap((row) => [row.updated_at, row.last_message_at].filter(Boolean) as string[]), ...(messages ?? []).map((row) => row.created_at), ...(responses ?? []).map((row) => row.answered_at), ...(redFlags ?? []).map((row) => row.created_at), ...(semanticAlerts ?? []).map((row) => row.created_at), ...(actions ?? []).map((row) => row.updated_at), ...episodeAudits.map((row) => row.created_at)];
  return {
    sourceUpdatedAt: candidates.sort().at(-1) ?? episode.updated_at,
    allowedIds: { messages: new Set((messages ?? []).map((row) => row.id)), responses: new Set((responses ?? []).map((row) => row.id)), alerts: new Set([...(redFlags ?? []).map((row) => row.id), ...(semanticAlerts ?? []).map((row) => row.id)]) },
    payload: { episode, patient, doctor, conversations, messages: (messages ?? []).reverse(), structured_responses: responses, steps, flows, deterministic_alerts: redFlags, alert_rules: rules, semantic_alerts: semanticAlerts, automations, scheduled_actions: actions, human_interventions: episodeAudits },
  };
}
