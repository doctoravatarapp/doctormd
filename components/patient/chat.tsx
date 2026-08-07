"use client";
import { useEffect, useRef, useState } from "react";

type Message = { id: string; sender_type: "patient" | "ai" | "doctor" | "staff" | "system"; content: string; created_at: string };

export function PatientChat({ conversationId, initialMessages }: { conversationId: string; initialMessages: Message[] }) {
  const [messages, setMessages] = useState(initialMessages); const [text, setText] = useState(""); const [state, setState] = useState<"idle" | "sending" | "responding" | "error">("idle"); const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [messages]);
  async function send() {
    const content = text.trim(); if (!content || (state !== "idle" && state !== "error")) return;
    const clientMessageId = crypto.randomUUID(); setText(""); setState("sending");
    setMessages((current) => [...current, { id: clientMessageId, sender_type: "patient", content, created_at: new Date().toISOString() }]);
    try {
      const response = await fetch("/api/patient/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId, content, clientMessageId }) });
      if (!response.ok || !response.body) throw new Error(await response.text());
      setState("responding"); const aiId = `ai-${clientMessageId}`; setMessages((current) => [...current, { id: aiId, sender_type: "ai", content: "", created_at: new Date().toISOString() }]);
      const reader = response.body.getReader(); const decoder = new TextDecoder();
      while (true) { const { done, value } = await reader.read(); if (done) break; const chunk = decoder.decode(value, { stream: true }); setMessages((current) => current.map((message) => message.id === aiId ? { ...message, content: message.content + chunk } : message)); }
      setState("idle");
    } catch { setState("error"); }
  }
  return <><div className="chat-messages">{messages.length ? messages.map((message) => <article className={`chat-message ${message.sender_type}`} key={message.id}><span>{message.sender_type === "patient" ? "Você" : message.sender_type === "ai" ? "APolloMD" : "Equipe"}</span><p>{message.content || "…"}</p><time>{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.created_at))}</time></article>) : <div className="chat-welcome"><span>A</span><h2>Como você está hoje?</h2><p>Conte como está se sentindo ou tire uma dúvida sobre seu acompanhamento.</p></div>}<div ref={bottom} /></div><footer className="chat-composer">{state === "error" ? <div className="patient-error">Não foi possível obter a resposta. Sua mensagem foi salva; você pode tentar novamente.</div> : null}<div><textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} maxLength={2000} rows={1} placeholder={state === "responding" ? "APolloMD está respondendo…" : "Escreva uma mensagem"} disabled={state !== "idle" && state !== "error"} /><button onClick={() => void send()} disabled={!text.trim() || (state !== "idle" && state !== "error")} aria-label="Enviar">↑</button></div><small>Canal de acompanhamento. Em situações urgentes, procure atendimento adequado e não dependa exclusivamente deste chat.</small></footer></>;
}
