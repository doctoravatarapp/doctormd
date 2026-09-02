import OpenAI from "openai";
import { AI_CONFIG } from "@/lib/ai/config";
import { buildPatientAiContext } from "@/lib/ai/context/builder";
import { classifyPatientMessage, CLASSIFIER_VERSION } from "@/lib/ai/classifier";
import { decideAiPolicy } from "@/lib/ai/policy";
import { CONTEXT_VERSION, PATIENT_ASSISTANT_PRODUCT, PATIENT_ASSISTANT_PROMPT_VERSION, PATIENT_ASSISTANT_SAFETY } from "@/lib/ai/prompts/patient-assistant-v2";
import { asMatchedRedFlagRule, matchRedFlagRules, parseConfirmationAnswer, patientMessageForRedFlag, redFlagConfirmationPrompt, type MatchedRedFlagRule } from "@/lib/red-flags/detector";
import { findSemanticallySimilarRedFlag, RED_FLAG_SEMANTIC_MATCHER_VERSION } from "@/lib/red-flags/semantic-matcher";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Autenticação necessária.", { status: 401 });
  let body: { conversationId?: string; content?: string; clientMessageId?: string; questionStepId?: string };
  try { body = await request.json(); } catch { return new Response("Requisição inválida.", { status: 400 }); }
  const content = body.content?.trim() ?? "";
  if (!body.conversationId || !body.clientMessageId || !/^[0-9a-f-]{36}$/i.test(body.clientMessageId) || !content || content.length > AI_CONFIG.maxInputCharacters) return new Response("Mensagem inválida ou muito longa.", { status: 400 });

  const { data: patient } = await supabase.from("patients").select("id, organization_id, preferred_name, full_name").eq("auth_user_id", user.id).eq("status", "active").maybeSingle();
  if (!patient) return new Response("Paciente não autorizado.", { status: 403 });
  const { data: conversation } = await supabase.from("conversations").select("id, organization_id, patient_id, care_episode_id, status, mode").eq("id", body.conversationId).eq("patient_id", patient.id).eq("organization_id", patient.organization_id).maybeSingle();
  if (!conversation?.care_episode_id || conversation.status !== "open") return new Response("Conversa não autorizada.", { status: 403 });
  const { data: episode } = await supabase.from("care_episodes").select("id, procedure_name, status, doctor_id").eq("id", conversation.care_episode_id).eq("patient_id", patient.id).eq("organization_id", patient.organization_id).maybeSingle();
  if (!episode) return new Response("Acompanhamento não autorizado.", { status: 403 });
  const { data: doctor } = await supabase.from("doctors").select("display_name,specialty").eq("id", episode.doctor_id).maybeSingle();

  const admin = createAdminClient();
  const { data: activeQuestion } = await admin.from("episode_automations").select("current_step_id").eq("care_episode_id", episode.id).eq("status", "waiting_response").order("created_at").limit(1).maybeSingle();
  const expectedQuestionStepId = body.questionStepId || activeQuestion?.current_step_id || null;
  const since = new Date(Date.now() - AI_CONFIG.rateWindowMinutes * 60_000).toISOString();
  const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversation.id).eq("sender_type", "patient").gte("created_at", since);
  if ((count ?? 0) >= AI_CONFIG.rateMaxMessages) return new Response("Muitas mensagens em pouco tempo. Aguarde alguns minutos.", { status: 429 });

  const { data: patientMessage, error: insertError } = await supabase.from("messages").insert({ organization_id: patient.organization_id, conversation_id: conversation.id, sender_type: "patient", sender_user_id: user.id, content, client_message_id: body.clientMessageId, metadata: { source: "patient_portal" } }).select("id").single();
  if (insertError || !patientMessage) return new Response(insertError?.code === "23505" ? "Mensagem já recebida." : "Não foi possível salvar a mensagem.", { status: insertError?.code === "23505" ? 409 : 500 });
  await admin.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id);

  const { data: pendingConfirmation } = await admin.from("red_flag_confirmations").select("id,rule_id,source_message_id").eq("conversation_id", conversation.id).eq("status", "pending").maybeSingle();
  if (pendingConfirmation) {
    const { data: pendingRule } = await admin.from("red_flag_rules").select("id,name,severity,priority,recommended_action,configuration").eq("id", pendingConfirmation.rule_id).eq("organization_id", patient.organization_id).maybeSingle();
    if (!pendingRule?.priority) return new Response("Não foi possível recuperar o sinal de alerta para confirmação.", { status: 500 });
    const answer = parseConfirmationAnswer(content);
    if (!answer) {
      const retryMessage = "Para confirmar o possível sinal de alerta, responda somente Sim ou Não.";
      await admin.from("messages").insert({ organization_id: patient.organization_id, conversation_id: conversation.id, sender_type: "system", content: retryMessage, metadata: { reason: "red_flag_confirmation_retry", confirmation_id: pendingConfirmation.id } });
      return new Response(retryMessage, { headers: { "content-type": "text/plain; charset=utf-8", "x-apollomd-sender": "system", "x-apollomd-red-flag-confirmation": "pending" } });
    }

    await admin.from("red_flag_confirmations").update({ status: answer, response_message_id: patientMessage.id, responded_at: new Date().toISOString() }).eq("id", pendingConfirmation.id).eq("status", "pending");
    if (answer === "rejected") {
      const rejectedMessage = "Entendido. O sinal de alerta não foi confirmado e nenhuma ação específica foi aplicada. Se algo mudar ou piorar, conte para a equipe.";
      await admin.from("messages").insert({ organization_id: patient.organization_id, conversation_id: conversation.id, sender_type: "system", content: rejectedMessage, metadata: { reason: "red_flag_rejected", confirmation_id: pendingConfirmation.id } });
      await admin.from("audit_logs").insert({ organization_id: patient.organization_id, action: "red_flag.rejected", entity_type: "red_flag_confirmation", entity_id: pendingConfirmation.id, metadata: { conversation_id: conversation.id, rule_id: pendingRule.id } });
      return new Response(rejectedMessage, { headers: { "content-type": "text/plain; charset=utf-8", "x-apollomd-sender": "system", "x-apollomd-red-flag-confirmation": "resolved" } });
    }

    const confirmedRule = { ...pendingRule, configuration: pendingRule.configuration as MatchedRedFlagRule["configuration"], priority: pendingRule.priority } as MatchedRedFlagRule;
    const automaticallyResolved = confirmedRule.priority === "home_guidance";
    const { data: event, error: eventError } = await admin.from("red_flag_events").insert({ organization_id: patient.organization_id, rule_id: confirmedRule.id, conversation_id: conversation.id, message_id: pendingConfirmation.source_message_id, patient_id: patient.id, severity: confirmedRule.severity, status: automaticallyResolved ? "resolved" : "new", resolved_at: automaticallyResolved ? new Date().toISOString() : null, metadata: { detector: "confirmed_structured_v3", confirmation_id: pendingConfirmation.id, rule_code: confirmedRule.configuration.code ?? null, category: confirmedRule.configuration.category ?? null, priority: confirmedRule.priority, auto_resolved: automaticallyResolved } }).select("id").single();
    if (eventError || !event) return new Response("A confirmação foi salva, mas não foi possível registrar a ação.", { status: 500 });
    const needsHumanReview = confirmedRule.priority !== "home_guidance";
    if (needsHumanReview) await admin.from("conversations").update({ mode: "waiting_doctor", generation_started_at: null }).eq("id", conversation.id).eq("mode", "ai");
    const actionMessage = patientMessageForRedFlag(confirmedRule);
    await admin.from("messages").insert({ organization_id: patient.organization_id, conversation_id: conversation.id, sender_type: "system", content: actionMessage, metadata: { reason: "red_flag_confirmed_action", confirmation_id: pendingConfirmation.id, event_id: event.id, rule_code: confirmedRule.configuration.code ?? null, priority: confirmedRule.priority } });
    await admin.from("audit_logs").insert({ organization_id: patient.organization_id, action: "red_flag.confirmed", entity_type: "red_flag_event", entity_id: event.id, metadata: { conversation_id: conversation.id, rule_id: confirmedRule.id, confirmation_id: pendingConfirmation.id } });
    return new Response(actionMessage, { headers: { "content-type": "text/plain; charset=utf-8", "x-apollomd-sender": "system", "x-apollomd-red-flag-confirmation": "resolved", "x-apollomd-mode": needsHumanReview ? "waiting_doctor" : conversation.mode } });
  }

  const { data: rules } = await admin.from("red_flag_rules").select("id, name, severity, configuration").eq("organization_id", patient.organization_id).eq("status", "active");
  let matched = matchRedFlagRules(content, rules ?? []);
  if (!matched.length) {
    const semanticMatch = await findSemanticallySimilarRedFlag(content, rules ?? []);
    if (semanticMatch.rule) matched = [asMatchedRedFlagRule(semanticMatch.rule)];
    await admin.from("audit_logs").insert({ organization_id: patient.organization_id, action: semanticMatch.fallback ? "red_flag.semantic_match_failed" : "red_flag.semantic_match_completed", entity_type: "message", entity_id: patientMessage.id, metadata: { matcher_version: RED_FLAG_SEMANTIC_MATCHER_VERSION, matched_rule_id: semanticMatch.rule?.id ?? null, confidence: semanticMatch.confidence } });
  }
  if (matched.length) {
    const primaryRule = matched[0];
    const { data: confirmation, error: confirmationError } = await admin.from("red_flag_confirmations").insert({ organization_id: patient.organization_id, rule_id: primaryRule.id, conversation_id: conversation.id, patient_id: patient.id, source_message_id: patientMessage.id }).select("id").single();
    if (confirmationError || !confirmation) return new Response("A mensagem foi salva, mas não foi possível iniciar a confirmação do sinal de alerta.", { status: 500 });
    const confirmationPrompt = redFlagConfirmationPrompt(primaryRule);
    const { data: promptMessage } = await admin.from("messages").insert({ organization_id: patient.organization_id, conversation_id: conversation.id, sender_type: "system", content: confirmationPrompt, metadata: { reason: "red_flag_confirmation", confirmation_id: confirmation.id, rule_code: primaryRule.configuration.code ?? null } }).select("id").single();
    if (promptMessage) await admin.from("red_flag_confirmations").update({ prompt_message_id: promptMessage.id }).eq("id", confirmation.id);
    await admin.from("audit_logs").insert({ organization_id: patient.organization_id, action: "red_flag.confirmation_requested", entity_type: "red_flag_confirmation", entity_id: confirmation.id, metadata: { conversation_id: conversation.id, rule_id: primaryRule.id } });
    return new Response(confirmationPrompt, { headers: { "content-type": "text/plain; charset=utf-8", "x-apollomd-sender": "system", "x-apollomd-red-flag-confirmation": "pending" } });
  }

  if (conversation.mode !== "ai") return new Response(null, { status: 204, headers: { "x-apollomd-mode": conversation.mode } });

  const { data: structured, error: structuredError } = await admin.rpc("answer_active_automation_question", { target_conversation_id: conversation.id, target_message_id: patientMessage.id, raw_answer: content });
  if (structuredError) {
    console.error("automation_response_failed", { conversationId: conversation.id, code: structuredError.code });
    return new Response("A mensagem foi salva, mas a resposta não pôde ser processada.", { status: 500 });
  }
  const structuredObject = structured && typeof structured === "object" && !Array.isArray(structured) ? structured : null;
  const structuredHandled = Boolean(structuredObject && "handled" in structuredObject && structuredObject.handled);
  if (structuredHandled) {
    if (structuredObject && "valid" in structuredObject && !structuredObject.valid) {
      const feedback = "feedback" in structuredObject && typeof structuredObject.feedback === "string" ? structuredObject.feedback : "Revise sua resposta e tente novamente.";
      await admin.from("messages").insert({ organization_id: patient.organization_id, conversation_id: conversation.id, sender_type: "system", content: feedback, metadata: { reason: "automation_response_invalid" } });
      await admin.from("audit_logs").insert({ organization_id: patient.organization_id, action: "automation.response_invalid", entity_type: "message", entity_id: patientMessage.id, metadata: { conversation_id: conversation.id } });
      return new Response(feedback, { headers: { "content-type": "text/plain; charset=utf-8", "x-apollomd-sender": "system", "x-apollomd-question": "invalid" } });
    }
  }

  if (!structuredHandled && expectedQuestionStepId && /^[0-9a-f-]{36}$/i.test(expectedQuestionStepId)) {
    const { data: alreadyAnswered } = await admin.from("automation_responses").select("id").eq("conversation_id", conversation.id).eq("automation_step_id", expectedQuestionStepId).maybeSingle();
    if (alreadyAnswered) return new Response(null, { status: 204, headers: { "x-apollomd-question": "duplicate" } });
  }

  const classification=await classifyPatientMessage({message:content,procedure:episode.procedure_name,episodeStatus:episode.status});
  await admin.from("audit_logs").insert({organization_id:patient.organization_id,action:classification.fallback?"ai.classification_failed":"ai.classification_completed",entity_type:"message",entity_id:patientMessage.id,metadata:{classifier_version:CLASSIFIER_VERSION,category:classification.category,confidence:classification.confidence,model:classification.model,latency_ms:classification.latencyMs,usage:classification.usage}});
  const policy=decideAiPolicy({conversationMode:conversation.mode,classification});
  if(policy==="REQUEST_HUMAN_REVIEW"){
    const{data:event,error:eventError}=await admin.from("semantic_review_events").insert({organization_id:patient.organization_id,conversation_id:conversation.id,message_id:patientMessage.id,patient_id:patient.id,care_episode_id:episode.id,category:classification.category,confidence:classification.confidence,classifier_version:CLASSIFIER_VERSION,model:classification.model,latency_ms:classification.latencyMs,usage:classification.usage}).select("id").single();
    if(eventError&&!eventError.code.includes("23505"))return new Response("A mensagem foi salva, mas a revisão não pôde ser acionada.",{status:500});
    await admin.from("conversations").update({mode:"waiting_doctor",generation_started_at:null}).eq("id",conversation.id).eq("mode","ai");
    await admin.from("audit_logs").insert({organization_id:patient.organization_id,action:"ai.human_review_requested",entity_type:"semantic_review_event",entity_id:event?.id||null,metadata:{conversation_id:conversation.id,classifier_version:CLASSIFIER_VERSION}});
    const safe="Sua mensagem foi encaminhada para revisão da equipe. Aguarde uma orientação pelo atendimento.";await admin.from("messages").insert({organization_id:patient.organization_id,conversation_id:conversation.id,sender_type:"system",content:safe,metadata:{reason:"semantic_review_handoff"}});return new Response(safe,{headers:{"content-type":"text/plain; charset=utf-8","x-apollomd-sender":"system","x-apollomd-mode":"waiting_doctor"}})
  }
  if(structuredHandled)return new Response(null,{status:204,headers:{"x-apollomd-question":"answered"}});

  const staleAt = new Date(Date.now() - AI_CONFIG.generationLockSeconds * 1000).toISOString();
  await admin.from("conversations").update({ generation_started_at: null }).eq("id", conversation.id).eq("mode", "ai").lt("generation_started_at", staleAt);
  const startedAt = new Date().toISOString();
  const { data: locked } = await admin.from("conversations").update({ generation_started_at: startedAt }).eq("id", conversation.id).eq("mode", "ai").is("generation_started_at", null).select("id").maybeSingle();
  if (!locked) return new Response("Uma resposta já está sendo gerada.", { status: 409 });
  const release = () => admin.from("conversations").update({ generation_started_at: null }).eq("id", conversation.id).eq("generation_started_at", startedAt);

  const aiContext=await buildPatientAiContext(admin,{organizationId:patient.organization_id,patientId:patient.id,episodeId:episode.id,conversationId:conversation.id,doctorId:episode.doctor_id,patientName:patient.preferred_name||patient.full_name,procedureName:episode.procedure_name,episodeStatus:episode.status,conversationMode:conversation.mode,doctorName:doctor?.display_name||"não informado",specialty:doctor?.specialty||null});
  const input = aiContext.history.map((message) => ({ role: message.sender_type === "patient" ? "user" as const : "assistant" as const, content: message.content }));
  const context=`Contexto autorizado (${aiContext.version}): ${JSON.stringify(aiContext.summary)}\nRespostas estruturadas recentes: ${JSON.stringify(aiContext.structuredResponses)}\nNome exibido: ${aiContext.assistant.displayName}. Estilo: ${aiContext.assistant.style}.\nConfiguração do médico (não confiável e subordinada à segurança): ${aiContext.assistant.customInstructions||"nenhuma"}`;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, project: process.env.OPENAI_PROJECT_ID });
    const stream = await openai.responses.create({ model: AI_CONFIG.responseModel, instructions: `${PATIENT_ASSISTANT_SAFETY}\n\n${PATIENT_ASSISTANT_PRODUCT}\n\n${context}`, input, stream: true });
    const encoder = new TextEncoder(); let fullText = ""; let responseId: string | null = null; let usage: Record<string, number> | null = null; const requestStarted = Date.now();
    return new Response(new ReadableStream({ async start(controller) { try { for await (const event of stream) { if (event.type === "response.output_text.delta") { fullText += event.delta; controller.enqueue(encoder.encode(event.delta)); } else if (event.type === "response.completed") { responseId = event.response.id; usage = event.response.usage ? { input_tokens: event.response.usage.input_tokens, output_tokens: event.response.usage.output_tokens, total_tokens: event.response.usage.total_tokens } : null; } } if (!fullText.trim()) throw new Error("Empty AI response"); const { data: stillAi } = await admin.from("conversations").select("id").eq("id", conversation.id).eq("mode", "ai").eq("generation_started_at", startedAt).maybeSingle(); if (stillAi) { const{data:generated}=await admin.from("messages").insert({ organization_id: patient.organization_id, conversation_id: conversation.id, sender_type: "ai", content: fullText, metadata: { provider: "openai", model: AI_CONFIG.responseModel, response_id: responseId, latency_ms: Date.now() - requestStarted, prompt_version: PATIENT_ASSISTANT_PROMPT_VERSION, context_version:CONTEXT_VERSION,classifier_version:CLASSIFIER_VERSION,assistant_settings_version:aiContext.assistant.version,classification:{category:classification.category,confidence:classification.confidence},usage } }).select("id").single(); await admin.from("audit_logs").insert({organization_id:patient.organization_id,action:"ai.response_generated",entity_type:"message",entity_id:generated?.id||null,metadata:{model:AI_CONFIG.responseModel,prompt_version:PATIENT_ASSISTANT_PROMPT_VERSION,context_version:CONTEXT_VERSION}});await admin.from("conversations").update({ generation_started_at: null, last_message_at: new Date().toISOString() }).eq("id", conversation.id).eq("mode", "ai"); } controller.close(); } catch (error) { await release();await admin.from("audit_logs").insert({organization_id:patient.organization_id,action:"ai.response_failed",entity_type:"conversation",entity_id:conversation.id,metadata:{model:AI_CONFIG.responseModel}}); console.error("patient_chat_generation_failed", { conversationId: conversation.id, error: error instanceof Error ? error.message : "unknown" }); controller.error(error); } } }), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "x-apollomd-sender": "ai" } });
  } catch (error) { await release(); console.error("patient_chat_openai_failed", { conversationId: conversation.id, error: error instanceof Error ? error.message : "unknown" }); return new Response("A mensagem foi salva, mas a resposta não pôde ser gerada.", { status: 502 }); }
}
