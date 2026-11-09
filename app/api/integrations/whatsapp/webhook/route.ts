import { extractWhatsAppMessages, verifyWhatsAppSignature } from "@/lib/integrations/whatsapp/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deliberately disabled until durable inbox, patient verification and shared
// clinical orchestration are implemented. Never acknowledge live events without
// durable storage: Meta retries are essential for reliable message delivery.
function enabled(): boolean {
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

export async function POST(request: Request) {
  if (!enabled()) return new Response("Not found", { status: 404 });
  const secret = process.env.META_WHATSAPP_APP_SECRET;
  if (!secret) return new Response("Not configured", { status: 503 });
  const rawBody = await request.text();
  if (rawBody.length > 1024 * 1024) return new Response("Payload too large", { status: 413 });
  if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { return new Response("Bad request", { status: 400 }); }
  // Parser ready for next phase. Never log sender identifiers or content.
  extractWhatsAppMessages(payload);
  // Intentionally return a retryable error rather than silently discarding
  // signed events until durable persistence and tenant routing are implemented.
  return new Response("Webhook processing not yet enabled", { status: 503, headers: { "retry-after": "60" } });
}
