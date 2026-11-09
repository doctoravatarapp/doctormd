import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  if (process.env.WHATSAPP_ENABLED !== "true") return new Response("Not found", { status: 404 });
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("process_whatsapp_inbound_batch" as never, { batch_size: 20 } as never);
    if (error) {
      console.error("[whatsapp-worker]", JSON.stringify({ outcome: "rpc_error", code: error.code }));
      return Response.json({ error: "processing_unavailable" }, { status: 503 });
    }
    console.info("[whatsapp-worker]", JSON.stringify({ outcome: "batch_completed" }));
    return Response.json(data ?? { claimed: 0 });
  } catch {
    console.error("[whatsapp-worker]", JSON.stringify({ outcome: "exception" }));
    return Response.json({ error: "processing_unavailable" }, { status: 503 });
  }
}
