import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWhatsAppSignature } from "@/lib/integrations/whatsapp/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagnostics contain only outcome codes and counts, never identifiers or message bodies.
function audit(outcome: string, count?: number) {
  console.info("[whatsapp-webhook]", JSON.stringify({ outcome, ...(count === undefined ? {} : { count }) }));
}

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
  if (!enabled()) { audit("disabled"); return new Response("Not found", { status: 404 }); }
  audit("post_received");
  const secret = process.env.META_WHATSAPP_APP_SECRET;
  const expectedPhoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  if (!secret || !expectedPhoneId) { audit("missing_configuration"); return new Response("Not configured", { status: 503 }); }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 1024 * 1024) { audit("oversized"); return new Response("Payload too large", { status: 413 }); }
  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"), secret)) { audit("signature_rejected"); return new Response("Unauthorized", { status: 401 }); }
  audit("signature_verified");

  let payload: { object?: unknown; entry?: Entry[] };
  try { payload = JSON.parse(rawBody); } catch { audit("invalid_json"); return new Response("Bad request", { status: 400 }); }
  if (payload?.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) { audit("invalid_payload"); return new Response("Bad request", { status: 400 }); }

  const receipts: Array<{ id: string; status: "sent" | "delivered" | "read" | "failed"; code: string | null }> = [];
  const records: Array<{ provider_message_id: string; provider_phone_number_id: string; sender_wa_id: string; event_type: string; payload: unknown }> = [];
  for (const entry of payload.entry) {
    if (!Array.isArray(entry?.changes)) continue;
    for (const change of entry.changes) {
      if (change?.field !== "messages" || !change.value) continue;
      const phoneId = change.value.metadata?.phone_number_id;
      if (phoneId !== expectedPhoneId) continue;
      const statuses = (change.value as { statuses?: unknown }).statuses;
      if (Array.isArray(statuses)) for (const item of statuses) {
        if (!item || typeof item !== "object") continue;
        const receipt = item as { id?: unknown; status?: unknown; errors?: Array<{ code?: unknown }> };
        if (typeof receipt.id !== "string" || receipt.id.length > 512) continue;
        if (!["sent", "delivered", "read", "failed"].includes(String(receipt.status))) continue;
        const rawCode = receipt.errors?.[0]?.code;
        const code = typeof rawCode === "number" && Number.isSafeInteger(rawCode) ? String(rawCode) : null;
        receipts.push({ id: receipt.id, status: receipt.status as "sent" | "delivered" | "read" | "failed", code });
      }
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
      if (error) { audit("storage_error"); return new Response("Storage unavailable", { status: 503 }); }
    } catch {
      audit("storage_exception");
      return new Response("Storage unavailable", { status: 503 });
    }
  }
  if (receipts.length) {
    try {
      const admin = createAdminClient();
      for (const receipt of receipts) {
        const { error } = await admin.from("whatsapp_outbound_events" as "messages")
          .update({ delivery_status: receipt.status, delivery_error_code: receipt.code, delivery_updated_at: new Date().toISOString() } as never)
          .eq("provider_message_id" as "id", receipt.id)
          .eq("provider_phone_number_id" as "id", expectedPhoneId);
        if (error) { audit("receipt_storage_error"); return new Response("Storage unavailable", { status: 503 }); }
      }
    } catch { audit("receipt_storage_exception"); return new Response("Storage unavailable", { status: 503 }); }
    audit("delivery_receipts_stored", receipts.length);
  }
  audit(records.length ? "messages_stored" : "no_matching_messages", records.length);
  // Delivery receipts contain no incoming patient message and need no inbox row.
  return new Response("EVENT_RECEIVED", { status: 200, headers: { "cache-control": "no-store" } });
}
