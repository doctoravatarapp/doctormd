import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWhatsAppSignature } from "@/lib/integrations/whatsapp/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function enabled() {
  return process.env.WHATSAPP_ENABLED === "true";
}

export async function GET(request: Request) {
  if (!enabled()) return new Response("Not found", { status: 404 });
  const verifyToken = process.env.META_WHATSAPP_VERIFY_TOKEN;
  if (!verifyToken) return new Response("Not configured", { status: 503 });
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode !== "subscribe" || token !== verifyToken || !challenge || !/^\d{1,128}$/.test(challenge)) {
    return new Response("Forbidden", { status: 403 });
  }
  return new Response(challenge, { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

type Change = { field?: unknown; value?: { metadata?: { phone_number_id?: unknown }; messages?: unknown[] } };
type Entry = { changes?: Change[] };

export async function POST(request: Request) {
  if (!enabled()) return new Response("Not found", { status: 404 });
  const secret = process.env.META_WHATSAPP_APP_SECRET;
  const expectedPhoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!secret || !expectedPhoneId) return new Response("Not configured", { status: 503 });
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 1024 * 1024) return new Response("Payload too large", { status: 413 });
  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"), secret)) return new Response("Unauthorized", { status: 401 });

  let payload: { object?: unknown; entry?: Entry[] };
  try { payload = JSON.parse(rawBody); } catch { return new Response("Bad request", { status: 400 }); }
  if (payload?.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) return new Response("Bad request", { status: 400 });

  const records: Array<{ provider_message_id: string; provider_phone_number_id: string; sender_wa_id: string; event_type: string; payload: unknown }> = [];
  for (const entry of payload.entry) {
    if (!Array.isArray(entry?.changes)) continue;
    for (const change of entry.changes) {
      if (change?.field !== "messages" || !change.value) continue;
      const phoneId = change.value.metadata?.phone_number_id;
      if (phoneId !== expectedPhoneId) continue;
      if (!Array.isArray(change.value.messages)) continue;
      for (const item of change.value.messages) {
        if (!item || typeof item !== "object") continue;
        const msg = item as { id?: unknown; from?: unknown; type?: unknown };
        if (typeof msg.id !== "string" || typeof msg.from !== "string" || typeof msg.type !== "string") continue;
        if (msg.id.length > 512 || msg.from.length > 64 || msg.type.length > 64) continue;
        records.push({ provider_message_id: msg.id, provider_phone_number_id: phoneId, sender_wa_id: msg.from, event_type: msg.type, payload: item });
      }
    }
  }

  if (records.length) {
    try {
      const admin = createAdminClient();
      // Explicitly typed transport table pending regeneration of generated DB types.
      const { error } = await admin.from("whatsapp_inbound_events" as "messages").upsert(
        records as never,
        { onConflict: "provider_message_id", ignoreDuplicates: true }
      );
      if (error) return new Response("Storage unavailable", { status: 503 });
    } catch {
      return new Response("Storage unavailable", { status: 503 });
    }
  }
  // Delivery receipts contain no incoming patient message and need no inbox row.
  return new Response("EVENT_RECEIVED", { status: 200, headers: { "cache-control": "no-store" } });
}
