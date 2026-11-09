import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Doctor handoff and response use existing DB RPCs, which enforce organization
 * authorization, conversation mode, auditing and atomic transitions.
 * This endpoint does NOT bypass RLS or send WhatsApp directly.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let input: unknown;
  try { input = await request.json(); } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!input || typeof input !== "object") return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const body = input as Record<string, unknown>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (typeof body.conversationId !== "string" || !uuid.test(body.conversationId)) {
    return NextResponse.json({ error: "invalid_conversation" }, { status: 400 });
  }
  if (body.action === "takeover") {
    const { data, error } = await supabase.rpc("take_over_conversation", {
      target_conversation_id: body.conversationId,
    });
    if (error) return NextResponse.json({ error: "takeover_rejected" }, { status: error.code === "42501" ? 403 : 409 });
    return NextResponse.json({ accepted: data === true }, { headers: { "Cache-Control": "no-store" } });
  }
  if (body.action === "reply") {
    if (typeof body.content !== "string" || body.content.trim().length < 1 || body.content.length > 2000
      || typeof body.clientMessageId !== "string" || !uuid.test(body.clientMessageId)) {
      return NextResponse.json({ error: "invalid_reply" }, { status: 400 });
    }
    const { data, error } = await supabase.rpc("send_doctor_message", {
      target_conversation_id: body.conversationId,
      message_content: body.content,
      target_client_message_id: body.clientMessageId,
    });
    if (error) return NextResponse.json({ error: "reply_rejected" }, { status: error.code === "42501" ? 403 : 409 });
    return NextResponse.json({ messageId: data, delivery: "not_confirmed" }, {
      headers: { "Cache-Control": "no-store" },
    });
  }
  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
