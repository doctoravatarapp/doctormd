import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { calculateOperationalPriority, OPERATIONS_THRESHOLDS } from "./priority";

type Db = Awaited<ReturnType<typeof createClient>>;

export async function loadOperationalQueue(db: Db, organizationId: string) {
  const { data: episodes } = await db.from("care_episodes").select("id,patient_id,doctor_id,procedure_name,status,created_at,updated_at").eq("organization_id", organizationId).in("status", ["planned", "preoperative", "postoperative"]).order("updated_at", { ascending: false }).limit(OPERATIONS_THRESHOLDS.maximumCandidateEpisodes);
  const episodeIds = episodes?.map((row) => row.id) ?? [];
  if (!episodeIds.length) return [];
  const patientIds = [...new Set(episodes!.map((row) => row.patient_id))];
  const doctorIds = [...new Set(episodes!.map((row) => row.doctor_id))];
  const [{ data: patients }, { data: doctors }, { data: conversations }, { data: automations }] = await Promise.all([
    db.from("patients").select("id,full_name,preferred_name").in("id", patientIds),
    db.from("doctors").select("id,display_name").in("id", doctorIds),
    db.from("conversations").select("id,care_episode_id,mode,status,last_message_at,updated_at,taken_over_at,taken_over_doctor_id").in("care_episode_id", episodeIds).eq("status", "open"),
    db.from("episode_automations").select("id,care_episode_id,status,current_step_id,updated_at").in("care_episode_id", episodeIds).order("created_at", { ascending: false }),
  ]);
  const conversationIds = conversations?.map((row) => row.id) ?? [];
  const automationIds = automations?.map((row) => row.id) ?? [];
  const [{ data: redFlags }, { data: semanticAlerts }, { data: actions }, { data: patientMessages }] = await Promise.all([
    conversationIds.length ? db.from("red_flag_events").select("id,conversation_id,severity,status,created_at").in("conversation_id", conversationIds).in("status", ["new", "acknowledged"]) : Promise.resolve({ data: [] }),
    db.from("semantic_review_events").select("id,care_episode_id,conversation_id,status,created_at").in("care_episode_id", episodeIds).in("status", ["new", "acknowledged"]),
    automationIds.length ? db.from("scheduled_actions").select("id,episode_automation_id,status,scheduled_for,executed_at,step_type,step_name,last_error").in("episode_automation_id", automationIds).in("status", ["pending", "failed", "completed"]).order("scheduled_for", { ascending: false }) : Promise.resolve({ data: [] }),
    conversationIds.length ? db.from("messages").select("id,conversation_id,created_at").in("conversation_id", conversationIds).eq("sender_type", "patient").order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const patientNames = new Map(patients?.map((row) => [row.id, row.preferred_name || row.full_name]));
  const doctorNames = new Map(doctors?.map((row) => [row.id, row.display_name]));
  const conversationByEpisode = new Map(conversations?.map((row) => [row.care_episode_id, row]));
  const automationByEpisode = new Map<string, NonNullable<typeof automations>[number]>();
  for (const row of automations ?? []) if (!automationByEpisode.has(row.care_episode_id)) automationByEpisode.set(row.care_episode_id, row);
  return episodes!.map((episode) => {
    const conversation = conversationByEpisode.get(episode.id) ?? null;
    const automation = automationByEpisode.get(episode.id) ?? null;
    const ownActions = actions?.filter((row) => row.episode_automation_id === automation?.id) ?? [];
    const ownRed = redFlags?.filter((row) => row.conversation_id === conversation?.id) ?? [];
    const ownSemantic = semanticAlerts?.filter((row) => row.care_episode_id === episode.id) ?? [];
    const latestPatientMessageAt = patientMessages?.find((row) => row.conversation_id === conversation?.id)?.created_at ?? null;
    const operation = calculateOperationalPriority({ conversation: conversation ? { mode: conversation.mode, updatedAt: conversation.updated_at, takenOverAt: conversation.taken_over_at } : null, deterministicAlerts: ownRed.map((row) => ({ severity: row.severity, status: row.status, createdAt: row.created_at })), semanticAlerts: ownSemantic.map((row) => ({ status: row.status, createdAt: row.created_at })), automation: automation ? { status: automation.status, updatedAt: automation.updated_at } : null, actions: ownActions.map((row) => ({ status: row.status, scheduledFor: row.scheduled_for, executedAt: row.executed_at, stepType: row.step_type })), latestPatientMessageAt });
    const failedAction = ownActions.find((row) => row.status === "failed");
    return { ...episode, patientName: patientNames.get(episode.patient_id) ?? "Paciente", doctorName: doctorNames.get(episode.doctor_id) ?? "Médico", conversation, automation, openAlerts: ownRed.length + ownSemantic.length, deterministicAlerts: ownRed, semanticAlerts: ownSemantic, failedReason: failedAction?.last_error ? "Falha registrada; abra o acompanhamento para detalhes." : null, operation, lastInteractionAt: conversation?.last_message_at ?? episode.updated_at };
  });
}

export type OperationalQueueItem = Awaited<ReturnType<typeof loadOperationalQueue>>[number];
