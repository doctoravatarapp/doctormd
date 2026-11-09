import { createHmac, timingSafeEqual } from "node:crypto";

export type WhatsAppEvent = {
  id: string;
  from: string;
  type: string;
  text?: string;
  timestamp?: string;
};

export function verifyWhatsAppSignature(rawBody: string, signature: string | null, appSecret: string): boolean {
  if (!appSecret || !signature?.startsWith("sha256=")) return false;
  const suppliedHex = signature.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;
  const supplied = Buffer.from(suppliedHex, "hex");
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function extractWhatsAppMessages(payload: unknown): WhatsAppEvent[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const root = payload as Record<string, unknown>;
  if (root.object !== "whatsapp_business_account" || !Array.isArray(root.entry)) return [];
  const events: WhatsAppEvent[] = [];
  for (const entry of root.entry) {
    if (!entry || typeof entry !== "object" || !Array.isArray((entry as { changes?: unknown }).changes)) continue;
    for (const change of (entry as { changes: unknown[] }).changes) {
      if (!change || typeof change !== "object") continue;
      const c = change as { field?: unknown; value?: { messages?: unknown } };
      if (c.field !== "messages" || !Array.isArray(c.value?.messages)) continue;
      for (const message of c.value.messages) {
        if (!message || typeof message !== "object") continue;
        const m = message as { id?: unknown; from?: unknown; type?: unknown; text?: { body?: unknown }; timestamp?: unknown };
        if (typeof m.id !== "string" || typeof m.from !== "string" || typeof m.type !== "string") continue;
        events.push({ id: m.id, from: m.from, type: m.type, text: m.type === "text" && typeof m.text?.body === "string" ? m.text.body : undefined, timestamp: typeof m.timestamp === "string" ? m.timestamp : undefined });
      }
    }
  }
  return events;
}
