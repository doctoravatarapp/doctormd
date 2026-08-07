import OpenAI from "openai";
import { AI_CONFIG } from "@/lib/ai/config";
import { PATIENT_ASSISTANT_INSTRUCTIONS, PATIENT_ASSISTANT_PROMPT_VERSION } from "@/lib/ai/prompts/patient-assistant";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Autenticação necessária.", { status: 401 });
  let body: { conversationId?: string; content?: string; clientMessageId?: string };
  try { body = await request.json(); } catch { return new Response("Requisição inválida.", { status: 400 }); }
  const content = body.content?.trim() ?? "";
  if (!body.conversationId || !body.clientMessageId || !/^[0-9a-f-]{36}$/i.test(body.clientMessageId) || !content || content.length > AI_CONFIG.maxInputCharacters) return new Response("Mensagem inválida ou muito longa.", { status: 400 });

  const { data: patient } = await supabase.from("patients").select("id, organization_id, preferred_name, full_name").eq("auth_user_id", user.id).eq("status", "active").maybeSingle();
  if (!patient) return new Response("Paciente não autorizado.", { status: 403 });
  const { data: conversation } = await supabase.from("conversations").select("id, organization_id, patient_id, care_episode_id, status, mode").eq("id", body.conversationId).eq("patient_id", patient.id).eq("organization_id", patient.organization_id).maybeSingle();
  if (!conversation?.care_episode_id || conversation.status !== "open") return new Response("Conversa não autorizada.", { status: 403 });
  const { data: episode } = await supabase.from("care_episodes").select("id, procedure_name, status, doctor_id").eq("id", conversation.care_episode_id).eq("patient_id", patient.id).eq("organization_id", patient.organization_id).maybeSingle();
  if (!episode) return new Response("Acompanhamento não autorizado.", { status: 403 });
  const { data: doctor } = await supabase.from("doctors").select("display_name").eq("id", episode.doctor_id).maybeSingle();

  const admin = createAdminClient();
  const since = new Date(Date.now() - AI_CONFIG.rateWindowMinutes * 60_000).toISOString();
  const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversation.id).eq("sender_type", "patient").gte("created_at", since);
  if ((count ?? 0) >= AI_CONFIG.rateMaxMessages) return new Response("Muitas mensagens em pouco tempo. Aguarde alguns minutos.", { status: 429 });

  const { data: patientMessage, error: insertError } = await supabase.from("messages").insert({ organization_id: patient.organization_id, conversation_id: conversation.id, sender_type: "patient", sender_user_id: user.id, content, client_message_id: body.clientMessageId, metadata: { source: "patient_portal" } }).select("id").single();
  if (insertError || !patientMessage) return new Response(insertError?.code === "23505" ? "Mensagem já recebida." : "Não foi possível salvar a mensagem.", { status: insertError?.code === "23505" ? 409 : 500 });
  await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id);

  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const { data: rules } = await admin.from("red_flag_rules").select("id, name, severity, configuration").eq("organization_id", patient.organization_id).eq("status", "active");
  const normalizedContent = normalize(content);
  const matched = (rules ?? []).filter((rule) => {
    const configuration = rule.configuration as { match_type?: string; pattern?: string };
    return configuration.match_type === "contains" && configuration.pattern && normalizedContent.includes(normalize(configuration.pattern));
  });
  if (matched.length) {
    for (const rule of matched) {
      const { data: event, error: eventError } = await admin.from("red_flag_events").insert({ organization_id: patient.organization_id, rule_id: rule.id, conversation_id: conversation.id, message_id: patientMessage.id, patient_id: patient.id, severity: rule.severity, status: "new", metadata: { detector: "deterministic_contains" } }).select("id").single();
      if (eventError || !event) {
        console.error("red_flag_event_failed", { conversationId: conversation.id, ruleId: rule.id, code: eventError?.code });
        return new Response("A mensagem foi salva, mas não foi possível acionar a equipe.", { status: 500 });
      }
      if (event) await admin.from("audit_logs").insert({ organization_id: patient.organization_id, action: "red_flag.created", entity_type: "red_flag_event", entity_id: event.id, metadata: { conversation_id: conversation.id, rule_id: rule.id } });
    }
    const safeMessage = "Sua mensagem foi sinalizada para análise da equipe responsável. Aguarde uma orientação pelo atendimento.";
    await admin.from("conversations").update({ mode: "waiting_doctor", generation_started_at: null }).eq("id", conversation.id).eq("mode", "ai");
    await admin.from("messages").insert({ organization_id: patient.organization_id, conversation_id: conversation.id, sender_type: "system", content: safeMessage, metadata: { reason: "red_flag_handoff" } });
    return new Response(safeMessage, { headers: { "content-type": "text/plain; charset=utf-8", "x-apollomd-sender": "system" } });
  }

  if (conversation.mode !== "ai") return new Response(null, { status: 204, headers: { "x-apollomd-mode": conversation.mode } });

  const staleAt = new Date(Date.now() - AI_CONFIG.generationLockSeconds * 1000).toISOString();
  await admin.from("conversations").update({ generation_started_at: null }).eq("id", conversation.id).eq("mode", "ai").lt("generation_started_at", staleAt);
  const startedAt = new Date().toISOString();
  const { data: locked } = await admin.from("conversations").update({ generation_started_at: startedAt }).eq("id", conversation.id).eq("mode", "ai").is("generation_started_at", null).select("id").maybeSingle();
  if (!locked) return new Response("Uma resposta já está sendo gerada.", { status: 409 });
  const release = () => admin.from("conversations").update({ generation_started_at: null }).eq("id", conversation.id).eq("generation_started_at", startedAt);

  const { data: history } = await admin.from("messages").select("sender_type, content").eq("conversation_id", conversation.id).in("sender_type", ["patient", "ai"]).order("created_at", { ascending: false }).limit(AI_CONFIG.historyMessages);
  const input = (history ?? []).reverse().map((message) => ({ role: message.sender_type === "patient" ? "user" as const : "assistant" as const, content: message.content }));
  const context = `Contexto autorizado mínimo: paciente ${patient.preferred_name || patient.full_name}; procedimento ${episode.procedure_name}; fase ${episode.status}; médico ${doctor?.display_name || "não informado"}.`;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, project: process.env.OPENAI_PROJECT_ID });
    const stream = await openai.responses.create({ model: AI_CONFIG.model, instructions: `${PATIENT_ASSISTANT_INSTRUCTIONS}\n\n${context}`, input, stream: true });
    const encoder = new TextEncoder(); let fullText = ""; let responseId: string | null = null; let usage: Record<string, number> | null = null; const requestStarted = Date.now();
    return new Response(new ReadableStream({ async start(controller) { try { for await (const event of stream) { if (event.type === "response.output_text.delta") { fullText += event.delta; controller.enqueue(encoder.encode(event.delta)); } else if (event.type === "response.completed") { responseId = event.response.id; usage = event.response.usage ? { input_tokens: event.response.usage.input_tokens, output_tokens: event.response.usage.output_tokens, total_tokens: event.response.usage.total_tokens } : null; } } if (!fullText.trim()) throw new Error("Empty AI response"); const { data: stillAi } = await admin.from("conversations").select("id").eq("id", conversation.id).eq("mode", "ai").eq("generation_started_at", startedAt).maybeSingle(); if (stillAi) { await admin.from("messages").insert({ organization_id: patient.organization_id, conversation_id: conversation.id, sender_type: "ai", content: fullText, metadata: { provider: "openai", model: AI_CONFIG.model, response_id: responseId, latency_ms: Date.now() - requestStarted, prompt_version: PATIENT_ASSISTANT_PROMPT_VERSION, usage } }); await admin.from("conversations").update({ generation_started_at: null, last_message_at: new Date().toISOString() }).eq("id", conversation.id).eq("mode", "ai"); } controller.close(); } catch (error) { await release(); console.error("patient_chat_generation_failed", { conversationId: conversation.id, error: error instanceof Error ? error.message : "unknown" }); controller.error(error); } } }), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "x-apollomd-sender": "ai" } });
  } catch (error) { await release(); console.error("patient_chat_openai_failed", { conversationId: conversation.id, error: error instanceof Error ? error.message : "unknown" }); return new Response("A mensagem foi salva, mas a resposta não pôde ser gerada.", { status: 502 }); }
}
