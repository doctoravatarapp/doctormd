"use client";

import { useCallback, useEffect, useState } from "react";

type Alert = {
  id: string;
  conversation_id: string | null;
  severity: "review" | "high" | "critical";
  status: string;
  reason_code: string;
  created_at: string;
};
type Action = "takeover" | "reply" | "resume_ai";

export default function ClinicalAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/clinical/alerts", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 401 ? "Faça login para acessar os alertas." : "Não foi possível consultar os alertas.");
      const payload = await response.json() as { alerts?: Alert[] };
      setAlerts(payload.alerts ?? []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  async function act(alert: Alert, action: Action) {
    if (!alert.conversation_id || busy) return;
    if (action === "reply" && !drafts[alert.id]?.trim()) return;
    setBusy(alert.id);
    setFeedback(previous => ({ ...previous, [alert.id]: "" }));
    try {
      const response = await fetch("/api/clinical/conversations/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          conversationId: alert.conversation_id,
          ...(action === "reply" ? { content: drafts[alert.id], clientMessageId: crypto.randomUUID() } : {}),
        }),
      });
      const payload = await response.json() as { error?: string; delivery?: string };
      if (!response.ok) throw new Error(payload.error ?? "Operação recusada.");
      if (action === "reply") setDrafts(previous => ({ ...previous, [alert.id]: "" }));
      setFeedback(previous => ({ ...previous, [alert.id]:
        action === "reply" ? (payload.delivery === "queued_not_delivered" ? "Resposta registrada e enfileirada; entrega ainda não confirmada." : "Resposta registrada; envio ao WhatsApp não confirmado.")
          : action === "takeover" ? "Conversa assumida pelo médico." : "Conversa devolvida à IA." }));
      await reload();
    } catch (cause) {
      setFeedback(previous => ({ ...previous, [alert.id]: cause instanceof Error ? cause.message : "Erro ao executar ação." }));
    } finally {
      setBusy(null);
    }
  }

  return <main style={{ maxWidth: 860, margin: "3rem auto", padding: "0 1.5rem" }}>
    <h1>Alertas clínicos</h1>
    <p>Fila restrita aos alertas atribuídos ao seu perfil médico. Em situações de urgência, siga o protocolo assistencial e os canais de emergência; este painel não substitui atendimento imediato.</p>
    <button type="button" onClick={() => void reload()} disabled={loading}>Atualizar alertas</button>
    {error && <p role="alert">{error}</p>}
    {loading && <p>Carregando…</p>}
    {!loading && !error && alerts.length === 0 && <p>Nenhum alerta pendente.</p>}
    {alerts.map(alert => <section key={alert.id} style={{ border: "1px solid #999", borderRadius: 8, padding: 20, marginTop: 16 }}>
      <h2 style={{ fontSize: 20 }}>{alert.severity === "critical" ? "Crítico" : alert.severity === "high" ? "Alta prioridade" : "Revisão clínica"}</h2>
      <p>Motivo: {alert.reason_code} · Situação: {alert.status}</p>
      <p><small>Registrado em {new Date(alert.created_at).toLocaleString("pt-BR")}</small></p>
      {alert.conversation_id ? <>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" disabled={busy !== null} onClick={() => void act(alert, "takeover")}>Assumir conversa</button>
          <button type="button" disabled={busy !== null} onClick={() => void act(alert, "resume_ai")}>Devolver à IA</button>
        </div>
        <label style={{ display: "block", marginTop: 16 }}>Resposta médica
          <textarea style={{ display: "block", width: "100%", minHeight: 90 }} maxLength={2000}
            value={drafts[alert.id] ?? ""} onChange={event => setDrafts(previous => ({ ...previous, [alert.id]: event.target.value }))} />
        </label>
        <button type="button" disabled={busy !== null || !(drafts[alert.id] ?? "").trim()} onClick={() => void act(alert, "reply")}>Registrar e enfileirar resposta</button>
      </> : <p>Conversa não associada. Verifique o episódio clínico.</p>}
      {feedback[alert.id] && <p role="status">{feedback[alert.id]}</p>}
    </section>)}
  </main>;
}
