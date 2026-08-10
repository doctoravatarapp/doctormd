"use server";

import OpenAI from "openai";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/lib/auth/context";
import { AI_CONFIG } from "@/lib/ai/config";
import { buildEpisodeSummaryContext } from "@/lib/ai/context/episode-summary-builder";
import { EPISODE_SUMMARY_INSTRUCTIONS, EPISODE_SUMMARY_PROMPT_VERSION } from "@/lib/ai/prompts/episode-summary-v1";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type SourceItem = { text: string; source_message_ids: string[]; source_response_ids: string[]; source_alert_ids: string[] };
type Summary = { overview: string; key_patient_reports: SourceItem[]; structured_answers: SourceItem[]; alerts_summary: SourceItem[]; human_interventions: SourceItem[]; current_state: string };

const itemSchema = { type: "object", properties: { text: { type: "string" }, source_message_ids: { type: "array", items: { type: "string" } }, source_response_ids: { type: "array", items: { type: "string" } }, source_alert_ids: { type: "array", items: { type: "string" } } }, required: ["text", "source_message_ids", "source_response_ids", "source_alert_ids"], additionalProperties: false } as const;

export async function generateEpisodeSummary(form: FormData) {
  const episodeId = String(form.get("episode_id") ?? "");
  const context = await getAdminContext();
  if (!context.organization || !episodeId) redirect("/admin");
  const userDb = await createClient();
  const { data: allowedEpisode } = await userDb.from("care_episodes").select("id").eq("id", episodeId).eq("organization_id", context.organization.id).maybeSingle();
  if (!allowedEpisode) redirect("/admin?error=access");
  const db = createAdminClient();
  const source = await buildEpisodeSummaryContext(db, { organizationId: context.organization.id, episodeId });
  const { data: latest } = await db.from("episode_ai_summaries").select("summary_version").eq("care_episode_id", episodeId).order("summary_version", { ascending: false }).limit(1).maybeSingle();
  const version = (latest?.summary_version ?? 0) + 1;
  const { data: generation, error: lockError } = await db.from("episode_ai_summaries").insert({ organization_id: context.organization.id, care_episode_id: episodeId, summary_version: version, status: "generating", source_updated_at: source.sourceUpdatedAt, model: AI_CONFIG.summaryModel, prompt_version: EPISODE_SUMMARY_PROMPT_VERSION, generated_by: context.user.id }).select("id").single();
  if (lockError || !generation) redirect(`/admin/episodes/${episodeId}?summary=busy`);
  const started = Date.now();
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, project: process.env.OPENAI_PROJECT_ID });
    const response = await openai.responses.create({ model: AI_CONFIG.summaryModel, instructions: EPISODE_SUMMARY_INSTRUCTIONS, input: `Produza o resumo usando exclusivamente este payload JSON:\n${JSON.stringify(source.payload)}`, text: { format: { type: "json_schema", name: "episode_operational_summary", strict: true, schema: { type: "object", properties: { overview: { type: "string" }, key_patient_reports: { type: "array", items: itemSchema }, structured_answers: { type: "array", items: itemSchema }, alerts_summary: { type: "array", items: itemSchema }, human_interventions: { type: "array", items: itemSchema }, current_state: { type: "string" } }, required: ["overview", "key_patient_reports", "structured_answers", "alerts_summary", "human_interventions", "current_state"], additionalProperties: false } } } });
    const summary = JSON.parse(response.output_text) as Summary;
    const cleanIds = (ids: string[], allowed: Set<string>) => [...new Set(ids.filter((id) => allowed.has(id)))];
    const cleanItem = (item: SourceItem): SourceItem => ({ text: item.text, source_message_ids: cleanIds(item.source_message_ids, source.allowedIds.messages), source_response_ids: cleanIds(item.source_response_ids, source.allowedIds.responses), source_alert_ids: cleanIds(item.source_alert_ids, source.allowedIds.alerts) });
    const clean: Summary = { overview: summary.overview, key_patient_reports: summary.key_patient_reports.map(cleanItem), structured_answers: summary.structured_answers.map(cleanItem), alerts_summary: summary.alerts_summary.map(cleanItem), human_interventions: summary.human_interventions.map(cleanItem), current_state: summary.current_state };
    const usage = response.usage ? { operation: "episode_summary", input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens, total_tokens: response.usage.total_tokens } : { operation: "episode_summary" };
    await db.from("episode_ai_summaries").update({ status: "completed", overview: clean.overview, structured_content: clean, usage, latency_ms: Date.now() - started, generated_at: new Date().toISOString() }).eq("id", generation.id);
    await db.from("audit_logs").insert({ organization_id: context.organization.id, actor_user_id: context.user.id, action: "ai.episode_summary_generated", entity_type: "episode_ai_summary", entity_id: generation.id, metadata: { care_episode_id: episodeId, model: AI_CONFIG.summaryModel, prompt_version: EPISODE_SUMMARY_PROMPT_VERSION, usage } });
  } catch (error) {
    await db.from("episode_ai_summaries").update({ status: "failed", error_code: error instanceof Error ? error.name.slice(0, 80) : "generation_failed", latency_ms: Date.now() - started }).eq("id", generation.id);
    revalidatePath(`/admin/episodes/${episodeId}`);
    redirect(`/admin/episodes/${episodeId}?summary=error`);
  }
  revalidatePath(`/admin/episodes/${episodeId}`);
  redirect(`/admin/episodes/${episodeId}?summary=updated`);
}
