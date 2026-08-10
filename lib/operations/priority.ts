export const OPERATIONS_THRESHOLDS = {
  recentPatientMessageHours: 24,
  pageSize: 25,
  maximumCandidateEpisodes: 250,
} as const;

export type OperationalPriority = "urgent" | "high" | "normal" | "low";
export type OperationalReason = "critical_configured_alert" | "open_deterministic_alert" | "open_semantic_alert" | "waiting_doctor" | "human_takeover_active" | "automation_failed" | "automation_overdue" | "waiting_patient_response" | "recent_patient_message" | "no_pending_action";

export type PriorityInput = {
  conversation: { mode: "ai" | "waiting_doctor" | "doctor"; updatedAt: string; takenOverAt: string | null } | null;
  deterministicAlerts: { severity: "low" | "medium" | "high" | "critical"; status: string; createdAt: string }[];
  semanticAlerts: { status: string; createdAt: string }[];
  automation: { status: string; updatedAt: string } | null;
  actions: { status: string; scheduledFor: string; executedAt: string | null; stepType: string }[];
  latestPatientMessageAt: string | null;
  now?: Date;
};

export type PriorityResult = { priority: OperationalPriority; reasons: OperationalReason[]; since: string };

const open = (status: string) => status === "new" || status === "acknowledged";

export function calculateOperationalPriority(input: PriorityInput): PriorityResult {
  const now = input.now ?? new Date();
  const reasons: OperationalReason[] = [];
  const dates: string[] = [];
  const deterministic = input.deterministicAlerts.filter((alert) => open(alert.status));
  const semantic = input.semanticAlerts.filter((alert) => open(alert.status));
  if (deterministic.some((alert) => alert.severity === "critical")) reasons.push("critical_configured_alert");
  if (deterministic.length) { reasons.push("open_deterministic_alert"); dates.push(...deterministic.map((alert) => alert.createdAt)); }
  if (semantic.length) { reasons.push("open_semantic_alert"); dates.push(...semantic.map((alert) => alert.createdAt)); }
  if (input.conversation?.mode === "waiting_doctor") { reasons.push("waiting_doctor"); dates.push(input.conversation.updatedAt); }
  if (input.conversation?.mode === "doctor") { reasons.push("human_takeover_active"); dates.push(input.conversation.takenOverAt ?? input.conversation.updatedAt); }
  const failed = input.actions.filter((action) => action.status === "failed");
  if (failed.length) { reasons.push("automation_failed"); dates.push(...failed.map((action) => action.scheduledFor)); }
  const blocked = input.conversation?.mode !== "ai" || input.automation?.status === "paused" || input.automation?.status === "waiting_response";
  const overdue = input.actions.filter((action) => action.status === "pending" && action.scheduledFor < now.toISOString());
  if (overdue.length && !blocked) { reasons.push("automation_overdue"); dates.push(...overdue.map((action) => action.scheduledFor)); }
  if (input.automation?.status === "waiting_response") {
    reasons.push("waiting_patient_response");
    const question = input.actions.find((action) => action.stepType === "question" && action.status === "completed");
    dates.push(question?.executedAt ?? input.automation.updatedAt);
  }
  if (input.latestPatientMessageAt && new Date(input.latestPatientMessageAt).getTime() >= now.getTime() - OPERATIONS_THRESHOLDS.recentPatientMessageHours * 3_600_000) { reasons.push("recent_patient_message"); dates.push(input.latestPatientMessageAt); }
  if (!reasons.length) { reasons.push("no_pending_action"); dates.push(input.automation?.updatedAt ?? input.conversation?.updatedAt ?? now.toISOString()); }
  const priority: OperationalPriority = reasons.includes("critical_configured_alert") ? "urgent" : reasons.some((reason) => ["waiting_doctor", "human_takeover_active", "automation_failed", "automation_overdue", "open_deterministic_alert", "open_semantic_alert"].includes(reason)) ? "high" : reasons.some((reason) => ["waiting_patient_response", "recent_patient_message"].includes(reason)) ? "normal" : "low";
  return { priority, reasons: [...new Set(reasons)], since: dates.sort()[0] ?? now.toISOString() };
}

export const PRIORITY_LABELS: Record<OperationalPriority, string> = { urgent: "Urgente operacional", high: "Alta", normal: "Normal", low: "Baixa" };
export const REASON_LABELS: Record<OperationalReason, string> = {
  critical_configured_alert: "Alerta crítico configurado",
  open_deterministic_alert: "Alerta por regra configurada aberto",
  open_semantic_alert: "Sinalização da IA aberta",
  waiting_doctor: "Aguardando médico",
  human_takeover_active: "Atendimento humano ativo",
  automation_failed: "Falha de automação",
  automation_overdue: "Ação de automação atrasada",
  waiting_patient_response: "Aguardando resposta do paciente",
  recent_patient_message: "Mensagem recente do paciente",
  no_pending_action: "Sem pendências",
};
